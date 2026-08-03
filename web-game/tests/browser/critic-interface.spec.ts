import { expect, test, type Page } from "@playwright/test";

test.use({ trace: "off" });
test.setTimeout(180_000);

interface ContactReceipt {
  stateSeparationMeters: number;
  minimumSweepSeparationMeters: number;
  contactingAtEnd: boolean;
  risingContact: boolean;
  contactSubstep: number | null;
  contactCapsuleID: string | null;
}

interface RuntimeSample {
  relativeTick: number;
  health: number;
  contact: ContactReceipt;
  points: Record<string, [number, number, number]>;
}

interface CriticSnapshot {
  heavyRelativeTick: number;
  target: { health: number };
  candidateGeometryContact: ContactReceipt;
}

interface RuntimeEvent {
  eventID?: string;
  type: string;
  absoluteSimulationTick: number;
  heavyRelativeTick: number | null;
  attackSerial?: number;
  damage?: number;
  healthBefore?: number;
  healthAfter?: number;
  separationMicrometres?: number;
}

interface InputEdge {
  action: string;
  device: string;
  absoluteSimulationTick: number;
}

interface RunReceipt {
  eventLog: RuntimeEvent[];
  inputEdgeLog: InputEdge[];
}

async function waitForTick(page: Page, tick: number): Promise<void> {
  await page.waitForFunction((expected) => {
    const snapshot = window.__P30_CRITIC__?.snapshot() as Record<string, unknown> | undefined;
    return snapshot?.capturePaused === true && snapshot.absoluteSimulationTick === expected;
  }, tick);
}

async function resetAndStartHeavy(
  page: Page,
  edgeTick: number,
  offset: [number, number, number] = [0, 0, 0],
  input: "mouse" | "keyboard" = "mouse",
): Promise<void> {
  await page.evaluate(async ({ targetOffsetMicrometres, captureTick }) => {
    await window.__P30_CRITIC__!.resetAndPause({
      seed: 30012,
      targetOffsetMicrometres,
    });
    window.__P30_CRITIC__!.armCaptureTicks([captureTick]);
    window.__P30_CRITIC__!.resume();
  }, { targetOffsetMicrometres: offset, captureTick: edgeTick - 1 });
  await waitForTick(page, edgeTick - 1);
  if (input === "mouse") await page.mouse.down({ button: "right" });
  else await page.keyboard.down("KeyK");
  await page.evaluate((tick) => {
    window.__P30_CRITIC__!.armCaptureTicks([tick]);
    window.__P30_CRITIC__!.resume();
  }, edgeTick);
  await waitForTick(page, edgeTick);
  if (input === "mouse") await page.mouse.up({ button: "right" });
  else await page.keyboard.up("KeyK");
}

async function sample(page: Page): Promise<RuntimeSample> {
  return page.evaluate(() => {
    const hook = window.__P30_CRITIC__!;
    const snapshot = hook.snapshot() as unknown as CriticSnapshot;
    const geometry = hook.geometrySource();
    const vector = geometry.leftHandBone.position.clone();
    const point = (node: { getWorldPosition: (target: typeof vector) => typeof vector }) =>
      node.getWorldPosition(vector.clone()).toArray() as [number, number, number];
    return {
      relativeTick: snapshot.heavyRelativeTick,
      health: snapshot.target.health,
      contact: snapshot.candidateGeometryContact,
      points: {
        leftHand: point(geometry.leftHandBone),
        rightHand: point(geometry.rightHandBone),
        head: point(geometry.targetLandmarkBones.head),
        neck: point(geometry.targetLandmarkBones.neck),
        pelvis: point(geometry.targetLandmarkBones.pelvis),
      },
    };
  });
}

async function relativeTrace(page: Page, edgeTick: number): Promise<{
  samples: RuntimeSample[];
  events: RuntimeEvent[];
}> {
  await resetAndStartHeavy(page, edgeTick);
  const samples = [await sample(page)];
  for (let relativeTick = 1; relativeTick <= 56; relativeTick += 1) {
    const tick = edgeTick + relativeTick;
    await page.evaluate((captureTick) => {
      window.__P30_CRITIC__!.armCaptureTicks([captureTick]);
      window.__P30_CRITIC__!.resume();
    }, tick);
    await waitForTick(page, tick);
    samples.push(await sample(page));
  }
  const receipt = await page.evaluate(() => window.__P30_CRITIC__!.runReceipt()) as unknown as RunReceipt;
  return { samples, events: receipt.eventLog };
}

async function runToTerminal(
  page: Page,
  offset: [number, number, number],
  input: "mouse" | "keyboard" = "mouse",
): Promise<{ health: number; events: RuntimeEvent[]; edges: InputEdge[] }> {
  await resetAndStartHeavy(page, 24, offset, input);
  await page.evaluate(() => {
    window.__P30_CRITIC__!.armCaptureTicks([80]);
    window.__P30_CRITIC__!.resume();
  });
  await waitForTick(page, 80);
  const snapshot = await page.evaluate(() => window.__P30_CRITIC__!.snapshot()) as unknown as CriticSnapshot;
  const receipt = await page.evaluate(() => window.__P30_CRITIC__!.runReceipt()) as unknown as RunReceipt;
  return {
    health: snapshot.target.health,
    events: receipt.eventLog,
    edges: receipt.inputEdgeLog,
  };
}

function normalizedEvents(events: RuntimeEvent[], shift: number): RuntimeEvent[] {
  return events.map((event) => {
    const normalized = { ...event };
    delete normalized.eventID;
    normalized.absoluteSimulationTick -= shift;
    return normalized;
  });
}

test("Round012 heavy contact and SHIFT_PLUS_7 are exact relative identities", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?scenario=P30-heavy-strike-v1&seed=30012");
  await page.waitForFunction(() => window.__P30_CRITIC__ !== undefined);
  await page.evaluate(async () => window.__P30_CRITIC__!.whenReady());

  expect(await page.evaluate(() => {
    const event = new MouseEvent("contextmenu", { button: 2, bubbles: true, cancelable: true });
    return !document.querySelector("canvas#game-canvas")!.dispatchEvent(event);
  })).toBe(true);

  const canonical = await relativeTrace(page, 24);
  const shifted = await relativeTrace(page, 31);
  expect(shifted.samples).toEqual(canonical.samples);
  expect(normalizedEvents(shifted.events, 7)).toEqual(normalizedEvents(canonical.events, 0));

  expect(canonical.samples[20]!.contact.stateSeparationMeters).toBeGreaterThanOrEqual(0.08);
  expect(canonical.samples[21]!.contact.stateSeparationMeters).toBeGreaterThanOrEqual(0.03);
  expect(canonical.samples[22]!.contact).toMatchObject({
    risingContact: true,
    contactSubstep: 4033,
    contactCapsuleID: "right-thigh",
  });
  expect(canonical.samples[22]!.contact.stateSeparationMeters).toBeGreaterThanOrEqual(-0.005);
  expect(canonical.samples[22]!.contact.stateSeparationMeters).toBeLessThanOrEqual(0.000001);
  expect(Math.min(...canonical.samples.map(({ contact }) => contact.minimumSweepSeparationMeters)))
    .toBeGreaterThanOrEqual(-0.01);
  expect(canonical.samples[24]!.contact.stateSeparationMeters).toBeGreaterThanOrEqual(0.03);
  expect(canonical.samples.filter(({ contact }) => contact.risingContact)).toHaveLength(1);
  expect(canonical.samples[22]!.health).toBe(75);
  expect(canonical.events.filter(({ type }) => type === "heavy-damage")).toEqual([
    expect.objectContaining({
      absoluteSimulationTick: 46,
      heavyRelativeTick: 22,
      damage: 25,
      healthBefore: 100,
      healthAfter: 75,
    }),
  ]);
});

test("trusted alternate input and translated hit/miss geometry preserve the damage contract", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?scenario=P30-heavy-strike-v1&seed=30012");
  await page.waitForFunction(() => window.__P30_CRITIC__ !== undefined);

  const keyboard = await runToTerminal(page, [0, 0, 0], "keyboard");
  expect(keyboard.health).toBe(75);
  expect(keyboard.edges).toEqual([
    expect.objectContaining({ action: "heavy-strike", device: "keyboard", absoluteSimulationTick: 24 }),
  ]);

  const tangentHit = await runToTerminal(page, [10_000, 2_000, -11_500]);
  expect(tangentHit.health).toBe(75);
  expect(tangentHit.events.filter(({ type }) => type === "heavy-damage")).toEqual([
    expect.objectContaining({ absoluteSimulationTick: 46, damage: 25, healthAfter: 75 }),
  ]);

  for (const offset of [[1_800_000, 0, 0], [-1_800_000, 0, 0]] as Array<[number, number, number]>) {
    const miss = await runToTerminal(page, offset);
    expect(miss.health).toBe(100);
    expect(miss.events.some(({ type }) => type === "heavy-contact" || type === "heavy-damage"))
      .toBe(false);
  }
});
