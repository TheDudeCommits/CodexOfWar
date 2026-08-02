import dashboardData from "../public/data/codex-of-war.json";

type PieceStatus =
  | "queued"
  | "building"
  | "review-ready"
  | "criticized"
  | "revising"
  | "paused"
  | "accepted";

type Piece = {
  id: string;
  name: string;
  group: "Vertical slice" | "Roster expansion";
  status: PieceStatus;
  outcome: string;
  requiredEvidence: string[];
};

type EvidenceAsset = {
  label: string;
  path: string;
  sha256?: string;
};

type Dashboard = {
  project: {
    name: string;
    surface: string;
    updated: string;
    platform: string;
    engine: string;
    simulation: string;
    captureResolution: string;
    tagline: string;
  };
  stateModel: PieceStatus[];
  activeBuild: {
    pieceId: string;
    round: number;
    roundLabel: string;
    status: PieceStatus;
    builder: string;
    brief: string;
    facts: string[];
    evidenceFingerprint: Record<string, string | number | boolean>;
    evidenceBundle: {
      roundLabel: string;
      status: string;
      manifestPath: string;
      s01: EvidenceAsset;
      diagnostic: EvidenceAsset;
      metrics: Array<{
        label: string;
        value: string;
      }>;
      checks: string[];
      limitations: string[];
    };
    nextGate: string;
  };
  canonicalCapture: {
    shotId: string;
    name: string;
    purpose: string;
    camera: string;
    heroHeight: string;
    measuredHeroHeight: string;
    sceneRead: string;
    benchmarkId: string;
    benchmarkPolicy: string;
    capturePath: string;
    manifestPath: string;
    latestManifestPath: string;
    captureAvailable: boolean;
    manifestAvailable: boolean;
  };
  acceptance: {
    threshold: number;
    maximum: number;
    visualMinimum: string;
    combatMinimum: string;
    criterionFloor: string;
    blindPreference: string;
    hardFailurePolicy: string;
    p00Exception: string;
  };
  machineConstraints: Array<{
    label: string;
    value: string;
  }>;
  rounds: Array<{
    round: number;
    label: string;
    pieceId: string;
    phase: string;
    status: PieceStatus;
    date: string;
    engineRun?: boolean;
    actualGameCapturePerformed?: boolean;
    targetMatchedGameCapturePerformed?: boolean;
    gateQualifyingCapture?: boolean;
    builderBrief: string;
    evidence: string;
    evidenceLinks: string[];
    critic: {
      status: string;
      score: number | null;
      categoryFloor?: number;
      candidatePreferredCount?: number;
      comparisonCount?: number;
      requiredCandidatePreferredCount?: number;
      scoreLabel: string | null;
      preference: string | null;
      primaryGap: string | null;
    };
  }>;
  pieces: Piece[];
};

const dashboard = dashboardData as Dashboard;

function formatStatus(status: PieceStatus) {
  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function PieceGroup({
  title,
  kicker,
  pieces,
}: {
  title: string;
  kicker: string;
  pieces: Piece[];
}) {
  const headingId = `${title.toLowerCase().replaceAll(" ", "-")}-heading`;

  return (
    <section className="piece-group" aria-labelledby={headingId}>
      <div className="group-heading">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h3 id={headingId}>{title}</h3>
        </div>
        <span className="group-count">{pieces.length} pieces</span>
      </div>

      <div className="piece-list">
        {pieces.map((piece) => (
          <details
            className={`piece-card status-${piece.status}`}
            key={piece.id}
            open={piece.id === dashboard.activeBuild.pieceId}
          >
            <summary>
              <span className="piece-id">{piece.id}</span>
              <span className="piece-title">{piece.name}</span>
              <span className="piece-status">
                <span aria-hidden="true" className="status-dot" />
                {formatStatus(piece.status)}
              </span>
              <span aria-hidden="true" className="disclosure-mark" />
            </summary>
            <div className="piece-body">
              <p>{piece.outcome}</p>
              <div className="evidence-requirement">
                <span className="detail-label">Required proof</span>
                {piece.requiredEvidence.length > 0 ? (
                  <ul>
                    {piece.requiredEvidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="evidence-unset">
                    Evidence package is frozen when this roster piece enters
                    build.
                  </p>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const totalPieces = dashboard.pieces.length;
  const counts = dashboard.pieces.reduce<Record<PieceStatus, number>>(
    (result, piece) => {
      result[piece.status] += 1;
      return result;
    },
    {
      queued: 0,
      building: 0,
      "review-ready": 0,
      criticized: 0,
      revising: 0,
      paused: 0,
      accepted: 0,
    },
  );
  const activeCount =
    counts.building +
    counts["review-ready"] +
    counts.criticized +
    counts.revising;
  const activePiece = dashboard.pieces.find(
    (piece) => piece.id === dashboard.activeBuild.pieceId,
  );
  const activeStateIndex = dashboard.stateModel.indexOf(
    dashboard.activeBuild.status,
  );
  const verticalPieces = dashboard.pieces.filter(
    (piece) => piece.group === "Vertical slice",
  );
  const rosterPieces = dashboard.pieces.filter(
    (piece) => piece.group === "Roster expansion",
  );
  const capture = dashboard.canonicalCapture;

  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">
        Skip to production ledger
      </a>

      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Codex of War home">
          <span className="wordmark-mark" aria-hidden="true">
            CW
          </span>
          <span>
            <strong>{dashboard.project.name}</strong>
            <small>{dashboard.project.surface}</small>
          </span>
        </a>

        <nav aria-label="Dashboard sections">
          <a href="#active-build">Active build</a>
          <a href="#contracts">Contracts</a>
          <a href="#pieces">Pieces</a>
          <a href="#round-history">Rounds</a>
        </nav>

        <div className="ledger-state">
          <span aria-hidden="true" />
          Ledger live
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span>{dashboard.activeBuild.roundLabel}</span>
              Evidence before claims
            </p>
            <h1 id="page-title">{dashboard.project.tagline}</h1>
            <p className="hero-intro">
              A live production surface for a browser-native Three.js combat
              benchmark.
              Every piece advances through deterministic evidence; P00 proves
              the review infrastructure before later pieces must clear the
              visual bar.
            </p>

            <div className="hero-actions">
              <a className="primary-action" href="#active-build">
                Inspect {dashboard.activeBuild.pieceId}
                <span aria-hidden="true">↘</span>
              </a>
              <a className="text-action" href="#pieces">
                View all {totalPieces} pieces
              </a>
            </div>

            <dl className="hero-meta">
              <div>
                <dt>Target</dt>
                <dd>{dashboard.project.platform}</dd>
              </div>
              <div>
                <dt>Runtime</dt>
                <dd>
                  {dashboard.project.engine} · {dashboard.project.simulation}
                </dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{dashboard.project.captureResolution} fixed capture</dd>
              </div>
            </dl>
          </div>

          <aside className="capture-panel" aria-labelledby="capture-heading">
            <div className="capture-header">
              <div>
                <p className="panel-label">Latest filed engine context</p>
                <h2 id="capture-heading">
                  {capture.shotId} <span>{capture.name}</span>
                </h2>
              </div>
              <span
                className={`availability ${
                  capture.captureAvailable ? "is-filed" : "is-pending"
                }`}
              >
                <span aria-hidden="true" />
                {capture.captureAvailable ? "Filed" : "Capture pending"}
              </span>
            </div>

            <figure>
              <div className="capture-viewport">
                <object
                  aria-label={`${capture.shotId} ${capture.name} engine capture`}
                  data={capture.capturePath}
                  type="image/png"
                >
                  <div className="capture-fallback">
                    <span className="fallback-reticle" aria-hidden="true" />
                    <p>Engine evidence slot</p>
                    <strong>Awaiting deterministic capture</strong>
                    <small>{capture.capturePath}</small>
                  </div>
                </object>
                <span className="capture-corner corner-top-left" aria-hidden />
                <span className="capture-corner corner-top-right" aria-hidden />
                <span
                  className="capture-corner corner-bottom-left"
                  aria-hidden
                />
                <span
                  className="capture-corner corner-bottom-right"
                  aria-hidden
                />
                <div className="capture-overlay" aria-hidden="true">
                  <span>{dashboard.activeBuild.pieceId}</span>
                  <span>{dashboard.activeBuild.evidenceBundle.roundLabel}</span>
                  <span>{dashboard.project.captureResolution}</span>
                </div>
              </div>

              <figcaption>
                <div className="capture-purpose">
                  <span>{capture.purpose}</span>
                  <strong>
                    {capture.camera} · hero measured{" "}
                    {capture.measuredHeroHeight}
                  </strong>
                </div>
                <div className="evidence-links">
                  <a href={capture.capturePath}>Open capture</a>
                  <a href={capture.manifestPath}>Open manifest</a>
                  <a href={capture.latestManifestPath}>
                    P00-pinned latest
                  </a>
                </div>
              </figcaption>
            </figure>
          </aside>
        </section>

        <section className="signal-strip" aria-label="Production summary">
          <dl>
            <div>
              <dt>Active</dt>
              <dd>{activeCount}</dd>
              <small>{activePiece?.name ?? "No active piece"}</small>
            </div>
            <div>
              <dt>Review-ready</dt>
              <dd>{counts["review-ready"]}</dd>
              <small>
                {counts["review-ready"] > 0
                  ? "Awaiting blind critic"
                  : "No piece waiting"}
              </small>
            </div>
            <div>
              <dt>Accepted</dt>
              <dd>
                {counts.accepted}
                <span> / {totalPieces}</span>
              </dd>
              <small>Claims that cleared the loop</small>
            </div>
            <div className="threshold-signal">
              <dt>Acceptance line</dt>
              <dd>
                {dashboard.acceptance.threshold}
                <span> / {dashboard.acceptance.maximum}</span>
              </dd>
              <small>Plus every frozen gate</small>
            </div>
          </dl>
        </section>

        <section
          className="content-section active-build"
          id="active-build"
          aria-labelledby="active-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Current production focus</p>
              <h2 id="active-heading">
                {dashboard.activeBuild.pieceId}{" "}
                <span>{activePiece?.name}</span>
              </h2>
            </div>
            <span className={`large-status status-${dashboard.activeBuild.status}`}>
              <span aria-hidden="true" />
              {formatStatus(dashboard.activeBuild.status)}
            </span>
          </div>

          <div className="active-grid">
            <article className="builder-brief">
              <div className="brief-header">
                <span>{dashboard.activeBuild.builder}</span>
                <span>{dashboard.activeBuild.roundLabel}</span>
              </div>
              <h3>
                {dashboard.activeBuild.status === "revising"
                  ? "Round rejected. Rebuild in progress."
                  : dashboard.activeBuild.status === "building"
                    ? "Round rejected. Replacement build in progress."
                  : "Proof filed. Critic in progress."}
              </h3>
              <p className="brief-copy">{dashboard.activeBuild.brief}</p>

              <ol className="builder-facts">
                {dashboard.activeBuild.facts.map((fact, index) => (
                  <li key={fact}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{fact}</p>
                  </li>
                ))}
              </ol>

              <div className="next-gate">
                <span>Next gate</span>
                <p>{dashboard.activeBuild.nextGate}</p>
              </div>
            </article>

            <aside className="state-card" aria-labelledby="state-heading">
              <p className="panel-label">Frozen state model</p>
              <h3 id="state-heading">One piece. One observable gap.</h3>
              <ol className="state-path">
                {dashboard.stateModel.map((state, index) => {
                  const statePosition =
                    index < activeStateIndex
                      ? "is-past"
                      : index === activeStateIndex
                        ? "is-current"
                        : "is-future";

                  return (
                    <li className={statePosition} key={state}>
                      <span className="state-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{formatStatus(state)}</span>
                      {index === activeStateIndex && <strong>Now</strong>}
                    </li>
                  );
                })}
              </ol>
              <p className="state-note">
                A failed blind comparison returns the piece to{" "}
                <strong>Revising</strong> with one primary gap.
              </p>
            </aside>
          </div>

          <article className="evidence-bundle" aria-labelledby="evidence-heading">
            <div className="evidence-visual">
              <div className="evidence-visual-header">
                <div>
                  <p className="panel-label">Critic diagnostic</p>
                  <h3 id="evidence-heading">
                    {dashboard.activeBuild.evidenceBundle.diagnostic.label}
                  </h3>
                </div>
                <span className="availability is-filed">
                  <span aria-hidden="true" />
                  Filed
                </span>
              </div>
              <a
                className="turntable-link"
                href={dashboard.activeBuild.evidenceBundle.diagnostic.path}
              >
                <object
                  aria-label={dashboard.activeBuild.evidenceBundle.diagnostic.label}
                  data={dashboard.activeBuild.evidenceBundle.diagnostic.path}
                  type="image/png"
                />
              </a>
              {dashboard.activeBuild.evidenceBundle.diagnostic.sha256 ? (
                <div className="asset-hash">
                  <span>SHA-256</span>
                  <code>
                    {dashboard.activeBuild.evidenceBundle.diagnostic.sha256}
                  </code>
                </div>
              ) : (
                <div className="asset-hash">
                  <span>Evidence class</span>
                  <strong>Public candidate · rejected round</strong>
                </div>
              )}
            </div>

            <div className="evidence-ledger">
              <div className="evidence-ledger-header">
                <p className="panel-label">Latest filed evidence state</p>
                <strong>{dashboard.activeBuild.evidenceBundle.status}</strong>
              </div>

              <dl className="evidence-file-hashes">
                {[
                  dashboard.activeBuild.evidenceBundle.s01,
                  dashboard.activeBuild.evidenceBundle.diagnostic,
                ].map((asset) => (
                  <div key={asset.path}>
                    <dt>{asset.label}</dt>
                    <dd>
                      {asset.sha256 ? (
                        <code>{asset.sha256}</code>
                      ) : (
                        <a href={asset.path}>Open public candidate</a>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <dl className="evidence-metrics">
                {dashboard.activeBuild.evidenceBundle.metrics.map((metric) => (
                  <div key={metric.label}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="evidence-checks">
                <span>Verified</span>
                <ul>
                  {dashboard.activeBuild.evidenceBundle.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>

              <div className="evidence-limitations">
                <span>Honest limits</span>
                <ul>
                  {dashboard.activeBuild.evidenceBundle.limitations.map(
                    (limitation) => (
                      <li key={limitation}>{limitation}</li>
                    ),
                  )}
                </ul>
              </div>

              <div className="evidence-links evidence-bundle-links">
                <a href={dashboard.activeBuild.evidenceBundle.s01.path}>
                  Open candidate capture
                </a>
                <a href={dashboard.activeBuild.evidenceBundle.diagnostic.path}>
                  Open diagnostic
                </a>
                <a href={dashboard.activeBuild.evidenceBundle.manifestPath}>
                  Open public evidence record
                </a>
              </div>
            </div>
          </article>
        </section>

        <section
          className="content-section contracts"
          id="contracts"
          aria-labelledby="contracts-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Frozen before the builder starts</p>
              <h2 id="contracts-heading">
                Judge against a contract, <span>not a mood.</span>
              </h2>
            </div>
            <p className="section-note">
              The local benchmark never ships. Only its shot ID and derived
              measurements enter the ledger.
            </p>
          </div>

          <div className="contract-grid">
            <article className="contract-card camera-contract">
              <div className="contract-topline">
                <span>01 / Canonical framing</span>
                <strong>
                  {capture.shotId} {capture.name}
                </strong>
              </div>
              <div className="scale-callout">
                <strong>24–32%</strong>
                <span>hero height in frame</span>
              </div>
              <dl>
                <div>
                  <dt>Camera</dt>
                  <dd>{capture.camera}</dd>
                </div>
                <div>
                  <dt>Scene read</dt>
                  <dd>{capture.sceneRead}</dd>
                </div>
                <div>
                  <dt>Benchmark ID only</dt>
                  <dd>{capture.benchmarkId}</dd>
                </div>
              </dl>
              <p className="contract-policy">{capture.benchmarkPolicy}</p>
            </article>

            <article className="contract-card acceptance-contract">
              <div className="contract-topline">
                <span>02 / Acceptance gate</span>
                <strong>Blind comparison</strong>
              </div>
              <div className="score-callout">
                <strong>{dashboard.acceptance.threshold}</strong>
                <span>/ {dashboard.acceptance.maximum} minimum total</span>
              </div>
              <ul className="gate-list">
                <li>
                  <span>Visual subtotal</span>
                  <strong>{dashboard.acceptance.visualMinimum}</strong>
                </li>
                <li>
                  <span>Combat subtotal</span>
                  <strong>{dashboard.acceptance.combatMinimum}</strong>
                </li>
                <li>
                  <span>Criterion floor</span>
                  <strong>{dashboard.acceptance.criterionFloor}</strong>
                </li>
                <li>
                  <span>A/B preference</span>
                  <strong>{dashboard.acceptance.blindPreference}</strong>
                </li>
                <li>
                  <span>Hard failures</span>
                  <strong>{dashboard.acceptance.hardFailurePolicy}</strong>
                </li>
              </ul>
              <div className="p00-exception">
                <span>P00 exception</span>
                <p>{dashboard.acceptance.p00Exception}</p>
              </div>
            </article>

            <article className="contract-card machine-contract">
              <div className="contract-topline">
                <span>03 / Machine envelope</span>
                <strong>Benchmark target</strong>
              </div>
              <p className="machine-intro">
                The quality bar and delivery contract are native to the
                benchmark machine.
              </p>
              <dl className="machine-grid">
                {dashboard.machineConstraints.map((constraint) => (
                  <div key={constraint.label}>
                    <dt>{constraint.label}</dt>
                    <dd>{constraint.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>
        </section>

        <section
          className="content-section pieces"
          id="pieces"
          aria-labelledby="pieces-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Judgeable build backlog</p>
              <h2 id="pieces-heading">
                {totalPieces} pieces. <span>No invisible “done.”</span>
              </h2>
            </div>
            <p className="section-note">
              Open a piece to inspect its independently judgeable outcome and
              required proof.
            </p>
          </div>

          <PieceGroup
            kicker="Foundation through delivery"
            pieces={verticalPieces}
            title="Vertical slice"
          />
          <PieceGroup
            kicker="Unlocked after the integrated encounter"
            pieces={rosterPieces}
            title="Roster expansion"
          />
        </section>

        <section
          className="content-section round-history"
          id="round-history"
          aria-labelledby="rounds-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Builder / critic ledger</p>
              <h2 id="rounds-heading">
                Round history <span>without invented scores.</span>
              </h2>
            </div>
            <p className="section-note">
              Scores appear only after the critic locks a blind comparison and
              reveals identity.
            </p>
          </div>

          <div className="round-list">
            {dashboard.rounds.map((round) => (
              <article
                className="round-card"
                key={`${round.pieceId}-${round.round}`}
              >
                <div className="round-index" aria-hidden="true">
                  {String(round.round).padStart(2, "0")}
                </div>

                <div className="round-main">
                  <div className="round-heading">
                    <div>
                      <span>
                        {round.pieceId} · {round.phase}
                      </span>
                      <h3>{round.label}</h3>
                    </div>
                    <time dateTime={round.date}>{round.date}</time>
                  </div>
                  <p>{round.builderBrief}</p>
                  <div className="round-evidence">
                    <span>Evidence state</span>
                    <strong>{round.evidence}</strong>
                  </div>
                  <div className="round-file-links">
                    {round.evidenceLinks.map((path) => (
                      <a href={path} key={path}>
                        {path}
                      </a>
                    ))}
                  </div>
                </div>

                <dl className="critic-state">
                  <div>
                    <dt>Critic</dt>
                    <dd>{round.critic.status}</dd>
                  </div>
                  <div>
                  <dt>Score</dt>
                  <dd>
                      {round.critic.scoreLabel ?? "— Not scored"}
                  </dd>
                  </div>
                  <div>
                    <dt>Preference</dt>
                    <dd>{round.critic.preference ?? "— Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Primary gap</dt>
                    <dd>{round.critic.primaryGap ?? "— Not assigned"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-mark">
          <span aria-hidden="true">CW</span>
          <p>
            <strong>{dashboard.project.name}</strong>
            <small>{dashboard.project.surface}</small>
          </p>
        </div>
        <p>
          Checked-in production data · Updated{" "}
          <time dateTime={dashboard.project.updated}>
            {dashboard.project.updated}
          </time>
        </p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </div>
  );
}
