# Round012 zombie asset intake

This is a fail-closed intake gate for exactly one candidate: **Zombie 3D** by
Zombie 3D (`@chuvit`), Sketchfab model
`31ca8d86b4074312a51170d8e7dbe07c`.

## Outcome

**Rejected; no third-party artifact was added.** The license permits
redistribution with attribution, but the official artifact record contradicts
the listing's production-critical claims. The uploaded source is an unrigged
OBJ/MTL with one 2048 px RGB PNG, not an original rigged GLB/FBX with PBR map
set. Sketchfab has generated a GLB conversion, but its authorized download
requires a logged-in user and the current session was anonymous.

The distinction matters: `CC BY 4.0 permits redistribution` does not mean an
agent may bypass the source site's authenticated download flow, and a generated
GLB container does not create a rig or missing texture channels.

## License-to-bytes authorization boundary

Technical validity is never sufficient for admission. `npm run gate -- <path>`
first loads the fixed `AUTHORIZED_ARTIFACT.json` path from `INTAKE_POLICY.json`
and verifies all of the following before parsing or validating the GLB:

1. the policy pins both the exact authorization-binding SHA-256 and the trusted
   acquisition authority's Ed25519 public key as SPKI DER base64 plus SHA-256;
2. the binding names this candidate UID, exact artifact hash/size, license
   UID/slug/record URL, Sketchfab API version, model/download endpoints, HTTP
   method, GLB archive format, and authenticated acquisition method;
3. the source record exactly matches schema
   `p30.r012.sketchfab-data-api-v3-source-download-record.v1`, with no extra or
   omitted fields, and proves successful official model and download records;
4. that record reports the expected model UID, `isDownloadable=true`, expected
   license UID/slug/URL, authenticated `GET` download, GLB archive key/format,
   exact provider-reported size, and a matching SHA-256 when the provider
   reports one;
5. contained source-record and acquisition-receipt bytes match the hashes in
   the binding, and the receipt cross-binds their semantic fields; and
6. a raw 64-byte detached Ed25519 signature from the policy-pinned authority is
   valid over the canonical authorization payload before the supplied artifact
   bytes are allowed to reach technical evaluation.

The canonical signed payload is deterministic UTF-8 JSON covering the payload
schema, candidate UID, artifact SHA-256/byte length, license ID/record URL,
download endpoint/method, source-record SHA-256, acquisition method,
acquisition-receipt SHA-256, and the `allow` decision. The authority key is
accepted only if it is a canonical Ed25519 SPKI public key whose DER bytes match
the separately pinned key hash. A public key supplied by a candidate record is
never trusted.

The current rejected candidate intentionally has no `AUTHORIZED_ARTIFACT.json`
or detached signature. Both `authorization.bindingSha256` and the acquisition
authority public-key fields are `null`. Therefore any supplied GLB rejects with
`AUTHORIZATION_TRUST_ANCHORS_UNSET_OR_INVALID`; technical evaluation is not
run. A fabricated, unsigned, or self-signed manifest cannot establish trust.

## Deterministic verification

From this directory:

```sh
env PATH=/opt/homebrew/opt/node@24/bin:$PATH npm ci
env PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run verify
```

`verify` confirms the rejection receipt, document hashes, absence of any
third-party model/archive, binding, signature, or private key, adversarial
authorization/provenance checks, GLB parser metrics, and a structured run of
the official Khronos glTF Validator plus glTF Transform. Node 24 and dependency
versions are locked.

## Acquisition-ready recheck

Do not scrape viewer payloads or guess archive URLs. An authorized acquisition
must capture the authenticated official Sketchfab Data API v3 model and
download records, then normalize only the required fields into the strict
source-record schema above. Create `AUTHORIZED_ARTIFACT.json` only after the
source record and acquisition receipt exist. Binding schema
`p30.r012.authorized-artifact-binding.v2` must include:

- `artifact.format`, exact `artifact.sha256`, and exact `artifact.byteLength`;
- license ID/UID/slug and the exact license-record URL;
- source provider/API version, exact model and download endpoints, method,
  archive format, contained record path, and record SHA-256; and
- `authorizationDecision: "allow"`, authorized method, contained receipt path
  and SHA-256, detached signature path, and `Ed25519` algorithm.

The acquisition receipt uses schema `p30.r012.acquisition-receipt.v2` and
repeats the authorization decision, UID, artifact hash/bytes, license identity,
source identity/record hash, and authorization method. After review, the
designated acquisition authority signs the canonical payload with an offline
Ed25519 private key. Store only the raw detached signature; **never put the
private key in this repository**. Pin the authority's public SPKI DER base64,
its SHA-256, and the exact binding-file SHA-256 in `INTAKE_POLICY.json`; then
run:

```sh
env PATH=/opt/homebrew/opt/node@24/bin:$PATH npm ci
env PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run gate -- /absolute/path/to/official-zombie-3d.glb
```

The gate measures and checks file hash/size, triangles, materials, embedded
texture count and dimensions, material texture channels, animation clips,
skins/joints/skinned nodes, external resources, official validator findings,
and glTF Transform validation/inspection. A report is printed as deterministic
JSON. Exit `0` means both authorization and technical gates passed; exit `2`
means reject. With the current unbound policy, exit `0` is impossible.

Even an authorized generated GLB is expected to fail the rig/PBR gates because
the first-party source record says `isRigged=false`, `pbrType=null`, and one
texture. A separately delivered rigged FBX/GLB from the creator is a **new
artifact**: require a new source URL, new hash, and explicit confirmation that
CC BY 4.0 applies to those exact bytes before evaluating it.

No gameplay, runtime asset folder, Round012 progress state, or baseline file is
changed by this intake.
