# P31 Round006 Nyra + Stormcage contact candidate

This is an isolated, non-integrated source workspace derived from frozen commit
`2c180e3`. It replaces only the authored Nyra and Stormcage files. The Hollow,
runtime source, manifest, camera, environment, HUD, simulation, physics, inputs,
and telemetry remain validation inputs and are never written by this pipeline.

## Build

```sh
blender --factory-startup --disable-autoexec --background \
  --python WebAssetSource/P31/source_work/round006_contact/build_contact.py
python3 WebAssetSource/P31/source_work/round006_contact/validate_glbs.py
blender --factory-startup --disable-autoexec --background \
  --python WebAssetSource/P31/source_work/round006_contact/validate_contact.py
blender --factory-startup --disable-autoexec --background \
  --python WebAssetSource/P31/source_work/round006_contact/validate_blender_reimport.py
```

The GLBs are written only to this directory's `glb/` folder. Production capture
uses a temporary copy of `web-game/`; it does not overwrite the shared runtime.
