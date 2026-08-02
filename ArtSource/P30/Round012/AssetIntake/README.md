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

## Deterministic verification

From this directory:

```sh
npm ci
npm run verify
```

`verify` confirms the rejection receipt, document hashes, absence of any
third-party model/archive, GLB parser metrics, and a structured run of the
official Khronos glTF Validator. The dependency versions are locked.

## Acquisition-ready recheck

Do not scrape viewer payloads or guess archive URLs. If an authorized Sketchfab
user intentionally downloads the official generated GLB, place it outside the
repository and run:

```sh
npm ci
npm run gate -- /absolute/path/to/official-zombie-3d.glb
```

The gate measures and checks file hash/size, triangles, materials, embedded
texture count and dimensions, material texture channels, animation clips,
skins/joints/skinned nodes, external resources, official validator findings,
and glTF Transform validation/inspection. A report is printed as deterministic
JSON. Exit `0` means admit; exit `2` means reject.

Even an authorized generated GLB is expected to fail the rig/PBR gates because
the first-party source record says `isRigged=false`, `pbrType=null`, and one
texture. A separately delivered rigged FBX/GLB from the creator is a **new
artifact**: require a new source URL, new hash, and explicit confirmation that
CC BY 4.0 applies to those exact bytes before evaluating it.

No gameplay, runtime asset folder, Round012 progress state, or baseline file is
changed by this intake.
