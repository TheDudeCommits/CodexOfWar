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

1. the policy pins the exact SHA-256 of the authorization binding;
2. the binding names this candidate UID, license ID and license-record URL;
3. the binding names the exact authorized source endpoint and an allowed
   acquisition method;
4. a contained source record and acquisition receipt match their pinned hashes;
5. the receipt cross-binds the UID, source, license, authorization method, exact
   artifact SHA-256 and exact byte length; and
6. the supplied artifact bytes match that SHA-256 and byte length.

The current rejected candidate intentionally has no `AUTHORIZED_ARTIFACT.json`
and `authorization.bindingSha256` is `null`. Therefore any supplied GLB rejects
with `AUTHORIZATION_BINDING_UNSET`; technical evaluation is not run. Adding a
manifest alone cannot change that because its hash must also be pinned by a
reviewed policy change.

## Deterministic verification

From this directory:

```sh
env PATH=/opt/homebrew/opt/node@24/bin:$PATH npm ci
env PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run verify
```

`verify` confirms the rejection receipt, document hashes, absence of any
third-party model/archive or authorization binding, adversarial provenance
checks, GLB parser metrics, and a structured run of the official Khronos glTF
Validator plus glTF Transform. Node 24 and dependency versions are locked.

## Acquisition-ready recheck

Do not scrape viewer payloads or guess archive URLs. An authorized acquisition
must first produce a reviewed, non-secret source record and acquisition receipt.
Create `AUTHORIZED_ARTIFACT.json` only after those records exist. It must bind:

- schema `p30.r012.authorized-artifact-binding.v1` and this candidate UID;
- `artifact.format`, exact `artifact.sha256`, and exact `artifact.byteLength`;
- `license.id` and the exact license-record URL;
- the exact source endpoint, contained record path, and record SHA-256; and
- authorization method, contained receipt path, and receipt SHA-256.

The acquisition receipt uses schema `p30.r012.acquisition-receipt.v1`, sets
`authorizationGranted: true`, and repeats the UID, artifact hash/bytes, license,
source endpoint/record hash, and authorization method. After human review, pin
the exact binding-file SHA-256 in `INTAKE_POLICY.json`; then run:

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
