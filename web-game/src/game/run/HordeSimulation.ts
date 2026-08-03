import {
  HORDE_BASE_WEAPON_DAMAGE,
  HORDE_COMBO_BASE_DURATION_TICKS,
  HORDE_COMBO_MAX_MULTIPLIER,
  HORDE_COMBO_STEP,
  HORDE_DEFAULT_ARENA_RADIUS,
  HORDE_DODGE_COST,
  HORDE_DODGE_DURATION_TICKS,
  HORDE_DODGE_INVULNERABLE_TICKS,
  HORDE_DODGE_SPEED,
  HORDE_ENEMIES,
  HORDE_FIXED_TIMESTEP,
  HORDE_MAX_WAVES,
  HORDE_PLAYER_HIT_STUN_TICKS,
  HORDE_PLAYER_RADIUS,
  HORDE_PLAYER_SPRINT_DRAIN_PER_TICK,
  HORDE_PLAYER_SPRINT_SPEED,
  HORDE_PLAYER_STAMINA_REGEN_PER_TICK,
  HORDE_PLAYER_WALK_SPEED,
  HORDE_UPGRADE_POOL,
  HORDE_WAVES,
  HORDE_WEAPON_BY_SLOT,
  HORDE_WEAPONS,
  type HordeAttackDefinition,
  type HordeEnemyDefinition,
  type HordeStrikeDefinition,
} from "./balance";
import {
  angleDistance,
  approachAngle,
  clamp,
  clampToRadius,
  deterministicSeparationDirection,
  directionToYaw,
  dot,
  length,
  nextRandomUint,
  normalized,
  perpendicular,
  random01FromUint,
  sanitizeSeed,
  yawToForward,
} from "./math";
import type {
  HordeEnemyArchetype,
  HordeEnemyState,
  HordeGameEvent,
  HordeInputFrame,
  HordeLockCandidate,
  HordeRunState,
  HordeSimulationOptions,
  HordeUpgradeId,
  HordeVec2,
  HordeWeaponId,
  HordeWeaponSlot,
} from "./types";

export const EMPTY_HORDE_INPUT: Readonly<HordeInputFrame> = Object.freeze({
  moveX: 0,
  moveZ: 0,
  sprint: false,
  dodgePressed: false,
  attackPressed: false,
  specialPressed: false,
  weaponSlot1Pressed: false,
  weaponSlot2Pressed: false,
  weaponSlot3Pressed: false,
  restartPressed: false,
});

type HordeGameEventPayload = HordeGameEvent extends infer Event
  ? Event extends HordeGameEvent
    ? Omit<Event, "id" | "tick">
    : never
  : never;

const DEFAULT_PLAYER_POSITION: Readonly<HordeVec2> = Object.freeze({ x: 0, z: 0 });

function createIdleAction() {
  return {
    kind: "none" as const,
    phase: "idle" as const,
    elapsedTicks: 0,
    durationTicks: 0,
    progress01: 0,
    serial: 0,
    hitKeys: [] as string[],
    facingYaw: 0,
  };
}

function setActionIdle(state: HordeRunState): void {
  const serial = state.player.action.serial;
  state.player.action = { ...createIdleAction(), serial, facingYaw: state.player.yaw };
}

export function createHordeEnemyState(
  id: number,
  archetype: HordeEnemyArchetype,
  position: HordeVec2,
  wave = 1,
  playerPosition: HordeVec2 = DEFAULT_PLAYER_POSITION,
): HordeEnemyState {
  const definition = HORDE_ENEMIES[archetype];
  const healthScale = 1 + Math.max(0, wave - 1) * 0.12;
  const maxHealth = Math.round(definition.maxHealth * healthScale);
  const toPlayer = {
    x: playerPosition.x - position.x,
    z: playerPosition.z - position.z,
  };
  return {
    id,
    archetype,
    position: { ...position },
    velocity: { x: 0, z: 0 },
    yaw: directionToYaw(toPlayer),
    health: maxHealth,
    maxHealth,
    radius: definition.radius,
    phase: archetype === "stalker" ? "flank" : "pursue",
    intent: "none",
    phaseElapsedTicks: 0,
    phaseDurationTicks: 0,
    phaseProgress01: 0,
    attackSerial: 0,
    attackHasResolved: false,
    orbitSign: id % 2 === 0 ? 1 : -1,
    staggerTicksRemaining: 0,
    spawnWave: wave,
  };
}

function nextRandom(state: HordeRunState): number {
  state.rngState = nextRandomUint(state.rngState);
  return random01FromUint(state.rngState);
}

function populateWave(state: HordeRunState): void {
  const composition = HORDE_WAVES[state.wave - 1];
  if (!composition) throw new Error(`No Horde Run wave definition for wave ${state.wave}.`);

  const enemies: HordeEnemyState[] = [];
  const angleOffset = nextRandom(state) * Math.PI * 2;
  for (let index = 0; index < composition.length; index += 1) {
    const archetype = composition[index];
    if (!archetype) continue;
    const jitter = (nextRandom(state) - 0.5) * 0.42;
    const angle = angleOffset + (index / composition.length) * Math.PI * 2 + jitter;
    const spawnRadius = Math.min(state.arenaRadius - 1.2, 7.7 + nextRandom(state) * 3.2);
    const position = {
      x: state.player.position.x + Math.cos(angle) * spawnRadius,
      z: state.player.position.z + Math.sin(angle) * spawnRadius,
    };
    clampToRadius(position, state.arenaRadius - HORDE_ENEMIES[archetype].radius);
    enemies.push(
      createHordeEnemyState(
        state.nextEnemyId,
        archetype,
        position,
        state.wave,
        state.player.position,
      ),
    );
    state.nextEnemyId += 1;
  }
  state.enemies = enemies;
}

export function createInitialHordeState(options: HordeSimulationOptions = {}): HordeRunState {
  const seed = sanitizeSeed(options.seed ?? 0xc0de_0f42);
  const initialPlayerPosition = options.playerPosition ?? DEFAULT_PLAYER_POSITION;
  const arenaRadius = Math.max(6, options.arenaRadius ?? HORDE_DEFAULT_ARENA_RADIUS);
  const state: HordeRunState = {
    schemaVersion: 1,
    seed,
    rngState: seed,
    tick: 0,
    elapsedSeconds: 0,
    phase: "combat",
    wave: 1,
    maxWaves: HORDE_MAX_WAVES,
    arenaRadius,
    initialPlayerPosition: { ...initialPlayerPosition },
    player: {
      position: { ...initialPlayerPosition },
      velocity: { x: 0, z: 0 },
      yaw: 0,
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      motion: "idle",
      speed01: 0,
      invulnerableTicksRemaining: 0,
      dodgeTicksRemaining: 0,
      dodgeTicksTotal: HORDE_DODGE_DURATION_TICKS,
      dodgeDirection: { x: 0, z: -1 },
      hitStunTicksRemaining: 0,
      selectedWeapon: "katana",
      lockedTargetId: null,
      action: createIdleAction(),
      specialCooldowns: {
        katana: 0,
        greatsword: 0,
        "twin-blades": 0,
      },
      stats: {
        damageMultiplier: 1,
        movementMultiplier: 1,
        staminaRegenMultiplier: 1,
        comboWindowBonusTicks: 0,
        executionDamageMultiplier: 1,
        essenceMultiplier: 1,
        healOnKill: 0,
      },
    },
    enemies: [],
    score: 0,
    kills: 0,
    essence: 0,
    combo: {
      count: 0,
      multiplier: 1,
      ticksRemaining: 0,
      durationTicks: HORDE_COMBO_BASE_DURATION_TICKS,
    },
    upgradeChoices: [],
    appliedUpgrades: [],
    nextEnemyId: 1,
    nextEventId: 1,
  };
  populateWave(state);
  return state;
}

export class HordeSimulation {
  state: HordeRunState;

  private readonly pendingEvents: HordeGameEvent[] = [];
  private readonly enemiesHitThisStep = new Set<number>();

  constructor(options: HordeSimulationOptions = {}) {
    this.state = createInitialHordeState(options);
    this.emit({ type: "wave-started", wave: this.state.wave, enemyCount: this.state.enemies.length });
  }

  static fromState(snapshot: HordeRunState): HordeSimulation {
    const simulation = new HordeSimulation({
      seed: snapshot.seed,
      playerPosition: snapshot.initialPlayerPosition,
      arenaRadius: snapshot.arenaRadius,
    });
    simulation.loadState(snapshot);
    return simulation;
  }

  loadState(snapshot: HordeRunState): void {
    if (snapshot.schemaVersion !== 1) {
      throw new Error(`Unsupported Horde Run state schema ${String(snapshot.schemaVersion)}.`);
    }
    this.state = structuredClone(snapshot);
    this.pendingEvents.length = 0;
    this.enemiesHitThisStep.clear();
  }

  exportState(): HordeRunState {
    return structuredClone(this.state);
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  consumeEvents(): HordeGameEvent[] {
    return this.pendingEvents.splice(0, this.pendingEvents.length);
  }

  getEnemyById(enemyId: number): HordeEnemyState | undefined {
    return this.state.enemies.find((enemy) => enemy.id === enemyId);
  }

  getLockCandidates(maxDistance = 18, facingYaw = this.state.player.yaw): HordeLockCandidate[] {
    const playerPosition = this.state.player.position;
    return this.state.enemies
      .filter((enemy) => enemy.phase !== "dead" && enemy.health > 0)
      .map((enemy): HordeLockCandidate => {
        const toEnemy = {
          x: enemy.position.x - playerPosition.x,
          z: enemy.position.z - playerPosition.z,
        };
        const candidateDistance = length(toEnemy);
        const candidateYaw = directionToYaw(toEnemy);
        const angleFromFacing = angleDistance(candidateYaw, facingYaw);
        const telegraphPriority = enemy.phase === "windup" ? -1.35 : 0;
        return {
          enemyId: enemy.id,
          archetype: enemy.archetype,
          position: { ...enemy.position },
          distance: candidateDistance,
          angleFromFacing,
          score: candidateDistance + angleFromFacing * 2.6 + telegraphPriority,
        };
      })
      .filter((candidate) => candidate.distance <= maxDistance)
      .sort((left, right) => left.score - right.score || left.enemyId - right.enemyId);
  }

  getBestLockTarget(maxDistance = 18, facingYaw = this.state.player.yaw): HordeEnemyState | undefined {
    const candidate = this.getLockCandidates(maxDistance, facingYaw)[0];
    return candidate ? this.getEnemyById(candidate.enemyId) : undefined;
  }

  lockBestTarget(maxDistance = 18): number | null {
    const target = this.getBestLockTarget(maxDistance);
    this.state.player.lockedTargetId = target?.id ?? null;
    return this.state.player.lockedTargetId;
  }

  cycleLockTarget(direction: -1 | 1 = 1, maxDistance = 18): number | null {
    const candidates = this.getLockCandidates(maxDistance);
    if (candidates.length === 0) {
      this.state.player.lockedTargetId = null;
      return null;
    }
    const currentIndex = candidates.findIndex(
      (candidate) => candidate.enemyId === this.state.player.lockedTargetId,
    );
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : candidates.length - 1
        : (currentIndex + direction + candidates.length) % candidates.length;
    const nextCandidate = candidates[nextIndex];
    this.state.player.lockedTargetId = nextCandidate?.enemyId ?? null;
    return this.state.player.lockedTargetId;
  }

  step(input: HordeInputFrame): void {
    if (
      input.restartPressed &&
      (this.state.phase === "defeat" || this.state.phase === "victory")
    ) {
      this.restart();
      return;
    }

    if (this.state.phase === "upgrade") {
      this.trySelectUpgrade(input.upgradeChoice);
      this.finishTick();
      return;
    }

    if (this.state.phase !== "combat") {
      this.finishTick();
      return;
    }

    this.enemiesHitThisStep.clear();
    this.tickPassiveTimers();
    this.updateRequestedLock(input.lockTargetId);
    this.tryWeaponSwitch(input);
    this.updatePlayer(input);

    if (this.state.phase === "combat") {
      for (const enemy of this.state.enemies) {
        if (this.state.phase !== "combat") break;
        this.updateEnemy(enemy);
      }
      this.separateEnemies();
      this.tickCombo();
      this.checkWaveCompletion();
    }

    this.finishTick();
  }

  restart(): void {
    const seed = this.state.seed;
    const playerPosition = { ...this.state.initialPlayerPosition };
    const arenaRadius = this.state.arenaRadius;
    this.state = createInitialHordeState({ seed, playerPosition, arenaRadius });
    this.pendingEvents.length = 0;
    this.enemiesHitThisStep.clear();
    this.emit({ type: "wave-started", wave: 1, enemyCount: this.state.enemies.length });
    this.emit({ type: "run-restarted", seed });
  }

  private emit(payload: HordeGameEventPayload): void {
    const event = {
      id: this.state.nextEventId,
      tick: this.state.tick,
      ...payload,
    } as HordeGameEvent;
    this.state.nextEventId += 1;
    this.pendingEvents.push(event);
  }

  private finishTick(): void {
    this.state.tick += 1;
    this.state.elapsedSeconds = this.state.tick * HORDE_FIXED_TIMESTEP;
  }

  private tickPassiveTimers(): void {
    const player = this.state.player;
    player.invulnerableTicksRemaining = Math.max(0, player.invulnerableTicksRemaining - 1);
    player.specialCooldowns.katana = Math.max(0, player.specialCooldowns.katana - 1);
    player.specialCooldowns.greatsword = Math.max(0, player.specialCooldowns.greatsword - 1);
    player.specialCooldowns["twin-blades"] = Math.max(
      0,
      player.specialCooldowns["twin-blades"] - 1,
    );
  }

  private updateRequestedLock(requested: number | null | undefined): void {
    const player = this.state.player;
    if (requested !== undefined) player.lockedTargetId = requested;
    if (player.lockedTargetId === null) return;
    const target = this.getEnemyById(player.lockedTargetId);
    if (!target || target.phase === "dead" || target.health <= 0) player.lockedTargetId = null;
  }

  private tryWeaponSwitch(input: HordeInputFrame): void {
    const player = this.state.player;
    if (
      player.action.kind !== "none" ||
      player.dodgeTicksRemaining > 0 ||
      player.hitStunTicksRemaining > 0
    ) {
      return;
    }
    let requestedSlot: HordeWeaponSlot | undefined;
    if (input.weaponSlot1Pressed) requestedSlot = 1;
    else if (input.weaponSlot2Pressed) requestedSlot = 2;
    else if (input.weaponSlot3Pressed) requestedSlot = 3;
    if (!requestedSlot) return;
    const weapon = HORDE_WEAPON_BY_SLOT[requestedSlot];
    if (weapon === player.selectedWeapon) return;
    player.selectedWeapon = weapon;
    this.emit({ type: "weapon-switched", weapon, slot: requestedSlot });
  }

  private updatePlayer(input: HordeInputFrame): void {
    const player = this.state.player;
    player.velocity.x = 0;
    player.velocity.z = 0;
    let regeneratesStamina = true;

    if (player.hitStunTicksRemaining > 0) {
      player.hitStunTicksRemaining -= 1;
      player.motion = "hit";
      player.speed01 = 0;
      regeneratesStamina = false;
      this.rejectBusyActions(input);
    } else if (player.dodgeTicksRemaining > 0) {
      player.motion = "dodge";
      player.speed01 = 1;
      const fade = clamp(player.dodgeTicksRemaining / 6, 0.42, 1);
      this.movePlayer(
        player.dodgeDirection,
        HORDE_DODGE_SPEED * player.stats.movementMultiplier * fade,
      );
      player.dodgeTicksRemaining -= 1;
      regeneratesStamina = false;
      this.rejectBusyActions(input);
    } else if (player.action.kind !== "none") {
      player.motion = player.action.kind === "special" ? "special" : "attack";
      player.speed01 = 0;
      this.rejectBusyActions(input);
      this.updatePlayerAction(input);
      regeneratesStamina = false;
    } else if (input.dodgePressed && player.stamina >= HORDE_DODGE_COST) {
      this.startDodge(input);
      regeneratesStamina = false;
    } else if (input.specialPressed) {
      regeneratesStamina = !this.tryStartSpecial(input);
    } else if (input.attackPressed) {
      regeneratesStamina = !this.tryStartNormalAttack(input);
    } else {
      regeneratesStamina = this.updateFreeMovement(input);
    }

    if (regeneratesStamina) {
      player.stamina = Math.min(
        player.maxStamina,
        player.stamina +
          HORDE_PLAYER_STAMINA_REGEN_PER_TICK * player.stats.staminaRegenMultiplier,
      );
    }
  }

  private rejectBusyActions(input: HordeInputFrame): void {
    const weapon = this.state.player.selectedWeapon;
    if (input.specialPressed) this.emit({ type: "special-rejected", weapon, reason: "busy" });
    if (input.attackPressed) this.emit({ type: "attack-rejected", weapon, reason: "busy" });
  }

  private startDodge(input: HordeInputFrame): void {
    const player = this.state.player;
    const requestedMove = this.requestedMove(input);
    const direction =
      length(requestedMove) > 0 ? normalized(requestedMove) : yawToForward(player.yaw);
    player.stamina -= HORDE_DODGE_COST;
    player.dodgeDirection = direction;
    player.dodgeTicksRemaining = HORDE_DODGE_DURATION_TICKS;
    player.dodgeTicksTotal = HORDE_DODGE_DURATION_TICKS;
    player.invulnerableTicksRemaining = HORDE_DODGE_INVULNERABLE_TICKS;
    player.yaw = directionToYaw(direction);
    player.motion = "dodge";
    player.speed01 = 1;
    this.movePlayer(direction, HORDE_DODGE_SPEED * player.stats.movementMultiplier);
    this.emit({
      type: "dodge-started",
      staminaCost: HORDE_DODGE_COST,
      invulnerableTicks: HORDE_DODGE_INVULNERABLE_TICKS,
    });
  }

  private tryStartNormalAttack(input: HordeInputFrame): boolean {
    const player = this.state.player;
    const weapon = HORDE_WEAPONS[player.selectedWeapon];
    if (this.state.phase !== "combat") {
      this.emit({ type: "attack-rejected", weapon: weapon.id, reason: "inactive" });
      return false;
    }
    if (player.stamina < weapon.normal.staminaCost) {
      this.emit({ type: "attack-rejected", weapon: weapon.id, reason: "stamina" });
      return false;
    }
    player.stamina -= weapon.normal.staminaCost;
    this.beginPlayerAction("normal", weapon.normal, input);
    this.emit({
      type: "attack-started",
      weapon: weapon.id,
      attackSerial: player.action.serial,
      staminaCost: weapon.normal.staminaCost,
    });
    return true;
  }

  private tryStartSpecial(input: HordeInputFrame): boolean {
    const player = this.state.player;
    const weapon = HORDE_WEAPONS[player.selectedWeapon];
    if (this.state.phase !== "combat") {
      this.emit({ type: "special-rejected", weapon: weapon.id, reason: "inactive" });
      return false;
    }
    if (player.specialCooldowns[weapon.id] > 0) {
      this.emit({ type: "special-rejected", weapon: weapon.id, reason: "cooldown" });
      return false;
    }
    if (player.stamina < weapon.special.staminaCost) {
      this.emit({ type: "special-rejected", weapon: weapon.id, reason: "stamina" });
      return false;
    }
    player.stamina -= weapon.special.staminaCost;
    player.specialCooldowns[weapon.id] = weapon.special.cooldownTicks;
    this.beginPlayerAction("special", weapon.special, input);
    this.emit({
      type: "special-started",
      weapon: weapon.id,
      attackSerial: player.action.serial,
      staminaCost: weapon.special.staminaCost,
      cooldownTicks: weapon.special.cooldownTicks,
    });
    return true;
  }

  private beginPlayerAction(
    kind: "normal" | "special",
    definition: HordeAttackDefinition,
    input: HordeInputFrame,
  ): void {
    const player = this.state.player;
    const serial = player.action.serial + 1;
    const facingYaw = this.resolveFacingYaw(input);
    player.yaw = facingYaw;
    player.action = {
      kind,
      phase: "startup",
      elapsedTicks: 0,
      durationTicks: definition.totalTicks,
      progress01: 0,
      serial,
      hitKeys: [],
      facingYaw,
    };
    player.motion = kind === "special" ? "special" : "attack";
    player.speed01 = 0;
  }

  private updatePlayerAction(input: HordeInputFrame): void {
    const player = this.state.player;
    if (player.action.kind === "none") return;
    const weapon = HORDE_WEAPONS[player.selectedWeapon];
    const isSpecial = player.action.kind === "special";
    const definition = isSpecial ? weapon.special : weapon.normal;
    player.action.elapsedTicks += 1;
    const elapsed = player.action.elapsedTicks;
    player.action.progress01 = clamp(elapsed / definition.totalTicks, 0, 1);
    if (elapsed < definition.activeFirstTick) player.action.phase = "startup";
    else if (elapsed <= definition.activeLastTick) player.action.phase = "active";
    else player.action.phase = "recovery";

    player.yaw = player.action.facingYaw;
    if (elapsed >= definition.dashFirstTick && elapsed <= definition.dashLastTick) {
      this.movePlayer(
        yawToForward(player.action.facingYaw),
        definition.dashSpeed * player.stats.movementMultiplier,
      );
    }
    if (definition.movementControl > 0) {
      const requestedMove = this.requestedMove(input);
      if (length(requestedMove) > 0) {
        this.movePlayer(
          normalized(requestedMove),
          HORDE_PLAYER_WALK_SPEED * definition.movementControl * player.stats.movementMultiplier,
        );
      }
    }

    for (let strikeIndex = 0; strikeIndex < definition.strikes.length; strikeIndex += 1) {
      const strike = definition.strikes[strikeIndex];
      if (strike?.tick === elapsed) this.resolvePlayerStrike(strike, strikeIndex, isSpecial);
    }

    if (elapsed >= definition.totalTicks) {
      setActionIdle(this.state);
      player.motion = "idle";
      player.speed01 = 0;
    }
  }

  private resolvePlayerStrike(
    strike: HordeStrikeDefinition,
    strikeIndex: number,
    special: boolean,
  ): void {
    const player = this.state.player;
    const forward = yawToForward(player.action.facingYaw);
    const candidates = this.state.enemies
      .filter((enemy) => enemy.phase !== "dead" && enemy.health > 0)
      .map((enemy) => {
        const toEnemy = {
          x: enemy.position.x - player.position.x,
          z: enemy.position.z - player.position.z,
        };
        const enemyDistance = length(toEnemy);
        const alignment = enemyDistance > 1e-9 ? clamp(dot(forward, normalized(toEnemy)), -1, 1) : 1;
        const angle = Math.acos(alignment);
        return { enemy, distance: enemyDistance, angle };
      })
      .filter(
        (candidate) =>
          candidate.distance <= strike.range + candidate.enemy.radius &&
          (strike.radial || candidate.angle <= strike.halfArcRadians),
      )
      .sort((left, right) => left.distance - right.distance || left.enemy.id - right.enemy.id)
      .slice(0, strike.maxTargets);

    for (const candidate of candidates) {
      const hitKey = `${strikeIndex}:${candidate.enemy.id}`;
      if (player.action.hitKeys.includes(hitKey)) continue;
      player.action.hitKeys.push(hitKey);
      this.damageEnemy(candidate.enemy, strike, strikeIndex, special);
    }
  }

  private damageEnemy(
    enemy: HordeEnemyState,
    strike: HordeStrikeDefinition,
    strikeIndex: number,
    special: boolean,
  ): void {
    const player = this.state.player;
    const weapon = player.selectedWeapon;
    const precisionMultiplier =
      weapon === "katana" && enemy.phase === "windup" ? 1.35 : 1;
    const executionMultiplier =
      enemy.health / enemy.maxHealth <= 0.3 ? player.stats.executionDamageMultiplier : 1;
    const damage = Math.max(
      1,
      Math.round(
        HORDE_BASE_WEAPON_DAMAGE *
          strike.damageMultiplier *
          player.stats.damageMultiplier *
          precisionMultiplier *
          executionMultiplier,
      ),
    );
    enemy.health = Math.max(0, enemy.health - damage);
    this.emit({
      type: "enemy-hit",
      enemyId: enemy.id,
      archetype: enemy.archetype,
      weapon,
      special,
      strikeIndex,
      damage,
      remainingHealth: enemy.health,
      attackSerial: player.action.serial,
    });

    const away = normalized(
      {
        x: enemy.position.x - player.position.x,
        z: enemy.position.z - player.position.z,
      },
      yawToForward(player.yaw),
    );
    enemy.position.x += away.x * strike.knockback;
    enemy.position.z += away.z * strike.knockback;
    clampToRadius(enemy.position, this.state.arenaRadius - enemy.radius);

    if (enemy.health <= 0) {
      enemy.phase = "dead";
      enemy.intent = "none";
      enemy.velocity = { x: 0, z: 0 };
      enemy.phaseElapsedTicks = 0;
      enemy.phaseDurationTicks = 0;
      enemy.phaseProgress01 = 1;
      enemy.staggerTicksRemaining = 0;
      if (player.lockedTargetId === enemy.id) player.lockedTargetId = null;
      this.awardKill(enemy, weapon);
      return;
    }

    enemy.phase = "hit";
    enemy.intent = "none";
    enemy.phaseElapsedTicks = 0;
    enemy.phaseDurationTicks = strike.staggerTicks;
    enemy.phaseProgress01 = 0;
    enemy.staggerTicksRemaining = strike.staggerTicks;
    enemy.attackHasResolved = true;
    this.enemiesHitThisStep.add(enemy.id);
  }

  private awardKill(enemy: HordeEnemyState, weapon: HordeWeaponId): void {
    const player = this.state.player;
    const definition = HORDE_ENEMIES[enemy.archetype];
    const scoringMultiplier = this.state.combo.multiplier;
    const scoreAwarded = Math.round(definition.score * scoringMultiplier);
    const essenceAwarded = Math.round(definition.essence * player.stats.essenceMultiplier);
    this.state.score += scoreAwarded;
    this.state.essence += essenceAwarded;
    this.state.kills += 1;
    this.state.combo.count += 1;
    this.state.combo.multiplier = Math.min(
      HORDE_COMBO_MAX_MULTIPLIER,
      1 + this.state.combo.count * HORDE_COMBO_STEP,
    );
    this.state.combo.durationTicks =
      HORDE_COMBO_BASE_DURATION_TICKS + player.stats.comboWindowBonusTicks;
    this.state.combo.ticksRemaining = this.state.combo.durationTicks;
    if (player.stats.healOnKill > 0) {
      player.health = Math.min(player.maxHealth, player.health + player.stats.healOnKill);
    }
    this.emit({
      type: "enemy-defeated",
      enemyId: enemy.id,
      archetype: enemy.archetype,
      weapon,
      scoreAwarded,
      essenceAwarded,
      comboMultiplier: scoringMultiplier,
    });
  }

  private updateFreeMovement(input: HordeInputFrame): boolean {
    const player = this.state.player;
    const requestedMove = this.requestedMove(input);
    const magnitude = clamp(length(requestedMove), 0, 1);
    if (magnitude <= 0) {
      player.motion = "idle";
      player.speed01 = 0;
      if (typeof input.faceYaw === "number") {
        player.yaw = approachAngle(player.yaw, input.faceYaw, 0.24);
      } else {
        this.faceLockedTarget(0.24);
      }
      return true;
    }

    const direction = normalized(requestedMove);
    const wantsSprint = input.sprint && player.stamina > 0.5;
    const speed =
      (wantsSprint ? HORDE_PLAYER_SPRINT_SPEED : HORDE_PLAYER_WALK_SPEED) *
      player.stats.movementMultiplier *
      magnitude;
    this.movePlayer(direction, speed);
    player.motion = wantsSprint ? "sprint" : "move";
    player.speed01 = wantsSprint ? 1 : 0.65;
    const targetYaw =
      typeof input.faceYaw === "number" ? input.faceYaw : directionToYaw(direction);
    player.yaw = approachAngle(player.yaw, targetYaw, 0.3);
    this.faceLockedTarget(0.34);
    if (wantsSprint) {
      player.stamina = Math.max(0, player.stamina - HORDE_PLAYER_SPRINT_DRAIN_PER_TICK);
      return false;
    }
    return true;
  }

  private requestedMove(input: HordeInputFrame): HordeVec2 {
    const magnitude = Math.hypot(input.moveX, input.moveZ);
    if (magnitude <= 1) return { x: input.moveX, z: input.moveZ };
    return { x: input.moveX / magnitude, z: input.moveZ / magnitude };
  }

  private resolveFacingYaw(input: HordeInputFrame): number {
    const locked =
      this.state.player.lockedTargetId === null
        ? undefined
        : this.getEnemyById(this.state.player.lockedTargetId);
    if (locked && locked.health > 0) {
      return directionToYaw({
        x: locked.position.x - this.state.player.position.x,
        z: locked.position.z - this.state.player.position.z,
      });
    }
    if (typeof input.faceYaw === "number") return input.faceYaw;
    return this.state.player.yaw;
  }

  private faceLockedTarget(maximumDelta: number): void {
    const player = this.state.player;
    if (player.lockedTargetId === null) return;
    const target = this.getEnemyById(player.lockedTargetId);
    if (!target || target.health <= 0) return;
    const targetYaw = directionToYaw({
      x: target.position.x - player.position.x,
      z: target.position.z - player.position.z,
    });
    player.yaw = approachAngle(player.yaw, targetYaw, maximumDelta);
  }

  private movePlayer(direction: HordeVec2, speed: number): void {
    const player = this.state.player;
    player.velocity.x += direction.x * speed;
    player.velocity.z += direction.z * speed;
    player.position.x += direction.x * speed * HORDE_FIXED_TIMESTEP;
    player.position.z += direction.z * speed * HORDE_FIXED_TIMESTEP;
    clampToRadius(player.position, this.state.arenaRadius - HORDE_PLAYER_RADIUS);
  }

  private updateEnemy(enemy: HordeEnemyState): void {
    if (enemy.phase === "dead" || enemy.health <= 0) return;
    enemy.velocity.x = 0;
    enemy.velocity.z = 0;
    if (this.enemiesHitThisStep.has(enemy.id)) return;

    if (enemy.staggerTicksRemaining > 0 || enemy.phase === "hit") {
      this.updateEnemyStagger(enemy);
      return;
    }

    const definition = HORDE_ENEMIES[enemy.archetype];
    switch (enemy.phase) {
      case "pursue":
        this.updatePursuit(enemy, definition);
        break;
      case "flank":
        this.updateFlank(enemy, definition);
        break;
      case "windup":
        this.updateEnemyWindup(enemy, definition);
        break;
      case "attack":
        this.updateEnemyAttack(enemy, definition);
        break;
      case "recover":
        this.updateEnemyRecovery(enemy);
        break;
    }
  }

  private updatePursuit(enemy: HordeEnemyState, definition: HordeEnemyDefinition): void {
    const toPlayer = this.toPlayer(enemy);
    const playerDistance = length(toPlayer);
    enemy.intent = "none";
    enemy.phaseProgress01 = 0;
    enemy.yaw = approachAngle(enemy.yaw, directionToYaw(toPlayer), 0.16);
    if (playerDistance <= definition.engageRange) {
      this.enterEnemyWindup(enemy, definition);
      return;
    }
    this.moveEnemy(enemy, normalized(toPlayer), definition.speed);
  }

  private updateFlank(enemy: HordeEnemyState, definition: HordeEnemyDefinition): void {
    const toPlayer = this.toPlayer(enemy);
    const playerDistance = length(toPlayer);
    const radial = normalized(toPlayer);
    const tangent = perpendicular(radial, enemy.orbitSign);
    const radialWeight = playerDistance > 3.4 ? 0.92 : 0.16;
    const desired = normalized({
      x: radial.x * radialWeight + tangent.x,
      z: radial.z * radialWeight + tangent.z,
    });
    enemy.intent = "none";
    enemy.phaseProgress01 = 0;
    enemy.yaw = approachAngle(enemy.yaw, directionToYaw(toPlayer), 0.28);
    if (playerDistance <= definition.engageRange) {
      this.enterEnemyWindup(enemy, definition);
      return;
    }
    this.moveEnemy(enemy, desired, definition.speed);
  }

  private enterEnemyWindup(enemy: HordeEnemyState, definition: HordeEnemyDefinition): void {
    enemy.phase = "windup";
    enemy.intent = definition.intent;
    enemy.phaseElapsedTicks = 0;
    enemy.phaseDurationTicks = definition.windupTicks;
    enemy.phaseProgress01 = 0;
    enemy.attackSerial += 1;
    enemy.attackHasResolved = false;
    enemy.yaw = directionToYaw(this.toPlayer(enemy));
    this.emit({
      type: "enemy-telegraph",
      enemyId: enemy.id,
      archetype: enemy.archetype,
      intent: definition.intent,
      attackSerial: enemy.attackSerial,
      resolveInTicks: definition.windupTicks + definition.hitTick,
    });
  }

  private updateEnemyWindup(enemy: HordeEnemyState, definition: HordeEnemyDefinition): void {
    enemy.phaseElapsedTicks += 1;
    enemy.phaseProgress01 = clamp(enemy.phaseElapsedTicks / enemy.phaseDurationTicks, 0, 1);
    enemy.yaw = approachAngle(enemy.yaw, directionToYaw(this.toPlayer(enemy)), 0.055);
    if (enemy.phaseElapsedTicks < enemy.phaseDurationTicks) return;
    enemy.phase = "attack";
    enemy.phaseElapsedTicks = 0;
    enemy.phaseDurationTicks = definition.attackTicks;
    enemy.phaseProgress01 = 0;
  }

  private updateEnemyAttack(enemy: HordeEnemyState, definition: HordeEnemyDefinition): void {
    enemy.phaseElapsedTicks += 1;
    enemy.phaseProgress01 = clamp(enemy.phaseElapsedTicks / enemy.phaseDurationTicks, 0, 1);
    if (enemy.archetype === "stalker" && enemy.phaseElapsedTicks <= definition.hitTick + 1) {
      this.moveEnemy(enemy, yawToForward(enemy.yaw), 5.8);
    } else if (enemy.archetype === "shambler" && enemy.phaseElapsedTicks <= definition.hitTick) {
      this.moveEnemy(enemy, yawToForward(enemy.yaw), 1.15);
    }
    if (!enemy.attackHasResolved && enemy.phaseElapsedTicks === definition.hitTick) {
      this.resolveEnemyAttack(enemy, definition);
    }
    if (enemy.phaseElapsedTicks < enemy.phaseDurationTicks) return;
    enemy.phase = "recover";
    enemy.intent = "none";
    enemy.phaseElapsedTicks = 0;
    enemy.phaseDurationTicks = definition.recoverTicks;
    enemy.phaseProgress01 = 0;
  }

  private resolveEnemyAttack(enemy: HordeEnemyState, definition: HordeEnemyDefinition): void {
    enemy.attackHasResolved = true;
    const toPlayer = this.toPlayer(enemy);
    const playerDistance = length(toPlayer);
    const forward = yawToForward(enemy.yaw);
    const alignment =
      playerDistance <= 1e-9 ? 1 : clamp(dot(forward, normalized(toPlayer)), -1, 1);
    const attackAngle = Math.acos(alignment);
    const hits =
      playerDistance <= definition.attackRange + HORDE_PLAYER_RADIUS &&
      attackAngle <= definition.attackHalfArcRadians;
    if (!hits) {
      this.emit({
        type: "enemy-attack-missed",
        enemyId: enemy.id,
        archetype: enemy.archetype,
        attackSerial: enemy.attackSerial,
      });
      return;
    }
    if (this.state.player.invulnerableTicksRemaining > 0) {
      this.emit({
        type: "enemy-attack-evaded",
        enemyId: enemy.id,
        archetype: enemy.archetype,
        attackSerial: enemy.attackSerial,
      });
      return;
    }
    const player = this.state.player;
    player.health = Math.max(0, player.health - definition.damage);
    player.hitStunTicksRemaining = HORDE_PLAYER_HIT_STUN_TICKS;
    player.dodgeTicksRemaining = 0;
    setActionIdle(this.state);
    player.motion = player.health > 0 ? "hit" : "dead";
    player.velocity = { x: 0, z: 0 };
    this.breakCombo("player-hit");
    this.emit({
      type: "enemy-attack-hit",
      enemyId: enemy.id,
      archetype: enemy.archetype,
      attackSerial: enemy.attackSerial,
      damage: definition.damage,
      remainingHealth: player.health,
    });
    if (player.health <= 0) {
      this.state.phase = "defeat";
      player.motion = "dead";
      this.emit({
        type: "player-defeated",
        wave: this.state.wave,
        score: this.state.score,
      });
    }
  }

  private updateEnemyRecovery(enemy: HordeEnemyState): void {
    enemy.phaseElapsedTicks += 1;
    enemy.phaseProgress01 = clamp(enemy.phaseElapsedTicks / enemy.phaseDurationTicks, 0, 1);
    if (enemy.phaseElapsedTicks < enemy.phaseDurationTicks) return;
    this.enterEnemyLocomotion(enemy);
  }

  private updateEnemyStagger(enemy: HordeEnemyState): void {
    enemy.phase = "hit";
    enemy.intent = "none";
    enemy.staggerTicksRemaining = Math.max(0, enemy.staggerTicksRemaining - 1);
    enemy.phaseElapsedTicks += 1;
    enemy.phaseProgress01 =
      enemy.phaseDurationTicks > 0
        ? clamp(enemy.phaseElapsedTicks / enemy.phaseDurationTicks, 0, 1)
        : 1;
    if (enemy.staggerTicksRemaining <= 0) this.enterEnemyLocomotion(enemy);
  }

  private enterEnemyLocomotion(enemy: HordeEnemyState): void {
    enemy.phase = enemy.archetype === "stalker" ? "flank" : "pursue";
    enemy.intent = "none";
    enemy.phaseElapsedTicks = 0;
    enemy.phaseDurationTicks = 0;
    enemy.phaseProgress01 = 0;
    enemy.staggerTicksRemaining = 0;
    enemy.attackHasResolved = false;
  }

  private toPlayer(enemy: HordeEnemyState): HordeVec2 {
    return {
      x: this.state.player.position.x - enemy.position.x,
      z: this.state.player.position.z - enemy.position.z,
    };
  }

  private moveEnemy(enemy: HordeEnemyState, direction: HordeVec2, speed: number): void {
    enemy.velocity.x = direction.x * speed;
    enemy.velocity.z = direction.z * speed;
    enemy.position.x += enemy.velocity.x * HORDE_FIXED_TIMESTEP;
    enemy.position.z += enemy.velocity.z * HORDE_FIXED_TIMESTEP;
    clampToRadius(enemy.position, this.state.arenaRadius - enemy.radius);
  }

  private separateEnemies(): void {
    const liveEnemies = this.state.enemies.filter(
      (enemy) => enemy.phase !== "dead" && enemy.health > 0,
    );
    for (let leftIndex = 0; leftIndex < liveEnemies.length; leftIndex += 1) {
      const left = liveEnemies[leftIndex];
      if (!left) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < liveEnemies.length; rightIndex += 1) {
        const right = liveEnemies[rightIndex];
        if (!right) continue;
        const delta = {
          x: right.position.x - left.position.x,
          z: right.position.z - left.position.z,
        };
        const currentDistance = length(delta);
        const minimumDistance = left.radius + right.radius + 0.08;
        if (currentDistance >= minimumDistance) continue;
        const direction =
          currentDistance > 1e-9
            ? { x: delta.x / currentDistance, z: delta.z / currentDistance }
            : deterministicSeparationDirection(left.id, right.id);
        const correction = (minimumDistance - currentDistance) * 0.5;
        left.position.x -= direction.x * correction;
        left.position.z -= direction.z * correction;
        right.position.x += direction.x * correction;
        right.position.z += direction.z * correction;
        clampToRadius(left.position, this.state.arenaRadius - left.radius);
        clampToRadius(right.position, this.state.arenaRadius - right.radius);
      }
    }

    for (const enemy of liveEnemies) {
      const awayFromPlayer = {
        x: enemy.position.x - this.state.player.position.x,
        z: enemy.position.z - this.state.player.position.z,
      };
      const currentDistance = length(awayFromPlayer);
      const minimumDistance = enemy.radius + HORDE_PLAYER_RADIUS;
      if (currentDistance >= minimumDistance) continue;
      const direction = normalized(
        awayFromPlayer,
        deterministicSeparationDirection(enemy.id, 0),
      );
      enemy.position.x = this.state.player.position.x + direction.x * minimumDistance;
      enemy.position.z = this.state.player.position.z + direction.z * minimumDistance;
      clampToRadius(enemy.position, this.state.arenaRadius - enemy.radius);
    }
  }

  private tickCombo(): void {
    const combo = this.state.combo;
    if (combo.count <= 0 || combo.ticksRemaining <= 0) return;
    combo.ticksRemaining -= 1;
    if (combo.ticksRemaining <= 0) this.breakCombo("timeout");
  }

  private breakCombo(reason: "timeout" | "player-hit"): void {
    const combo = this.state.combo;
    if (combo.count <= 0) return;
    const previousCount = combo.count;
    combo.count = 0;
    combo.multiplier = 1;
    combo.ticksRemaining = 0;
    this.emit({ type: "combo-broken", previousCount, reason });
  }

  private checkWaveCompletion(): void {
    if (this.state.enemies.some((enemy) => enemy.phase !== "dead" && enemy.health > 0)) return;
    this.emit({ type: "wave-cleared", wave: this.state.wave, score: this.state.score });
    setActionIdle(this.state);
    this.state.player.dodgeTicksRemaining = 0;
    this.state.player.velocity = { x: 0, z: 0 };
    if (this.state.wave >= this.state.maxWaves) {
      this.state.phase = "victory";
      this.state.player.motion = "victory";
      this.emit({
        type: "run-victory",
        score: this.state.score,
        kills: this.state.kills,
        essence: this.state.essence,
      });
      return;
    }
    this.state.phase = "upgrade";
    this.state.player.motion = "idle";
    this.state.upgradeChoices = this.generateUpgradeChoices();
    this.emit({
      type: "upgrade-offered",
      wave: this.state.wave,
      choices: [...this.state.upgradeChoices],
    });
  }

  private generateUpgradeChoices(): HordeUpgradeId[] {
    const available = HORDE_UPGRADE_POOL.filter(
      (upgrade) => !this.state.appliedUpgrades.includes(upgrade),
    );
    for (let index = available.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(nextRandom(this.state) * (index + 1));
      const temporary = available[index];
      const swap = available[swapIndex];
      if (!temporary || !swap) continue;
      available[index] = swap;
      available[swapIndex] = temporary;
    }
    return available.slice(0, 3);
  }

  private trySelectUpgrade(choiceIndex: 0 | 1 | 2 | undefined): void {
    if (choiceIndex === undefined) return;
    const upgrade = this.state.upgradeChoices[choiceIndex];
    if (!upgrade) return;
    this.applyUpgrade(upgrade);
    this.state.appliedUpgrades.push(upgrade);
    this.emit({ type: "upgrade-selected", upgrade, choiceIndex });
    this.state.upgradeChoices = [];
    this.state.wave += 1;
    this.state.phase = "combat";
    this.state.player.health = Math.min(
      this.state.player.maxHealth,
      this.state.player.health + 12,
    );
    this.state.player.stamina = this.state.player.maxStamina;
    this.state.player.motion = "idle";
    populateWave(this.state);
    this.emit({
      type: "wave-started",
      wave: this.state.wave,
      enemyCount: this.state.enemies.length,
    });
  }

  private applyUpgrade(upgrade: HordeUpgradeId): void {
    const player = this.state.player;
    switch (upgrade) {
      case "tempered-edge":
        player.stats.damageMultiplier *= 1.2;
        break;
      case "vitality-surge":
        player.maxHealth += 30;
        player.health = Math.min(player.maxHealth, player.health + 30);
        break;
      case "deep-reserves":
        player.maxStamina += 25;
        player.stamina = player.maxStamina;
        break;
      case "wind-runner":
        player.stats.movementMultiplier *= 1.15;
        break;
      case "second-wind":
        player.stats.staminaRegenMultiplier *= 1.35;
        break;
      case "combo-keeper":
        player.stats.comboWindowBonusTicks += 90;
        this.state.combo.durationTicks =
          HORDE_COMBO_BASE_DURATION_TICKS + player.stats.comboWindowBonusTicks;
        break;
      case "executioner":
        player.stats.executionDamageMultiplier *= 1.5;
        break;
      case "soul-magnet":
        player.stats.essenceMultiplier *= 1.3;
        break;
      case "battle-trance":
        player.stats.healOnKill += 6;
        break;
    }
  }
}
