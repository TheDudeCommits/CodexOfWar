using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using CodexOfWar.Review;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using Object = UnityEngine.Object;

namespace CodexOfWar.Editor.Review
{
    public static class P10HeroSceneBuilder
    {
        private const string ReviewRoot = "Assets/CodexOfWar/Review";
        private const string MaterialRoot =
            "Assets/CodexOfWar/Heroes/P10/Materials";
        private const string TextureRoot =
            "Assets/CodexOfWar/Heroes/P10/Textures";
        private const string ProfileRoot = ReviewRoot + "/Profiles";
        private const string CinematicProfilePath =
            ProfileRoot + "/P10_S01_CinematicVolume.asset";
        private const string TurntableProfilePath =
            ProfileRoot + "/P10_TurntableVolume.asset";
        private const string ProxyName = "HERO — Sentinel proxy";
        private const string HeroSceneName = "HERO — Astra Vale authored P10";

        private static readonly Vector3 HeroPosition =
            new Vector3(-1.55f, 0.0f, 0.1f);
        private static readonly Quaternion HeroRotation =
            new Quaternion(0.0f, 0.2775105f, 0.0f, 0.9607226f);

        [MenuItem("Codex of War/Review/Build P10 Hero Lookdev Scenes")]
        public static BuildResult BuildAndSave()
        {
            EnsureFolders();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            ConfigureModelImporter();
            var materials = CreateHeroMaterials();
            var cinematicProfile = BuildCinematicVolumeProfile();
            var repositoryRoot = GetRepositoryRoot();
            var p00SceneAbsolute = RepositoryPath(
                repositoryRoot,
                "game/" + P00CaptureContract.SceneAssetPath);
            var p00BytesBefore = File.ReadAllBytes(p00SceneAbsolute);
            var p00SceneHashBefore = P00CaptureContract.Sha256(p00BytesBefore);

            var baselineScene = EditorSceneManager.OpenScene(
                P00CaptureContract.SceneAssetPath,
                OpenSceneMode.Single);
            var frozenEnvironmentP00 = ComputeFrozenEnvironmentHash(baselineScene);
            if (!EditorSceneManager.SaveScene(
                    baselineScene,
                    P10CaptureContract.SceneAssetPath,
                    true))
            {
                throw new InvalidOperationException(
                    "Unity did not clone the P00 scene for isolated P10 work.");
            }

            var p10Scene = EditorSceneManager.OpenScene(
                P10CaptureContract.SceneAssetPath,
                OpenSceneMode.Single);
            ReplaceCinematicVolumeProfile(p10Scene, cinematicProfile);
            var proxy = FindByExactName(p10Scene, ProxyName);
            if (proxy == null)
            {
                throw new InvalidOperationException(
                    "The frozen P00 proxy root was not found: " + ProxyName);
            }

            var castParent = proxy.transform.parent;
            Object.DestroyImmediate(proxy);
            var hero = InstantiateHero(
                p10Scene,
                castParent,
                HeroPosition,
                HeroRotation,
                materials,
                false);
            ConfigureContract(p10Scene);
            var camera = FindReviewCamera(p10Scene);
            ValidateLockedCamera(camera);

            EditorSceneManager.MarkSceneDirty(p10Scene);
            if (!EditorSceneManager.SaveScene(
                    p10Scene,
                    P10CaptureContract.SceneAssetPath))
            {
                throw new InvalidOperationException(
                    "Unity did not save the isolated P10 lookdev scene.");
            }

            var frozenEnvironmentP10 = ComputeFrozenEnvironmentHash(p10Scene);
            if (!string.Equals(
                    frozenEnvironmentP00,
                    frozenEnvironmentP10,
                    StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "P10 modified the frozen P00 environment/camera signature. " +
                    frozenEnvironmentP00 +
                    " != " +
                    frozenEnvironmentP10);
            }

            var turntableCamera = BuildTurntableScene(materials);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);

            var p00BytesAfter = File.ReadAllBytes(p00SceneAbsolute);
            var p00SceneHashAfter = P00CaptureContract.Sha256(p00BytesAfter);
            if (!p00BytesBefore.SequenceEqual(p00BytesAfter))
            {
                throw new InvalidOperationException(
                    "The P00 historical scene changed while building P10.");
            }

            return new BuildResult
            {
                ReviewCamera = camera,
                TurntableCamera = turntableCamera,
                Hero = hero,
                P00SceneSha256Before = p00SceneHashBefore,
                P00SceneSha256After = p00SceneHashAfter,
                FrozenEnvironmentSha256P00 = frozenEnvironmentP00,
                FrozenEnvironmentSha256P10 = frozenEnvironmentP10
            };
        }

        public static IReadOnlyDictionary<string, Material> CreateHeroMaterials()
        {
            EnsureFolders();
            var result = new Dictionary<string, Material>(StringComparer.Ordinal)
            {
                {
                    "P10_Skin",
                    CreateLit(
                        "P10_Skin",
                        Color.white,
                        0.0f,
                        0.48f,
                        null,
                        TextureRoot + "/P10_Skin_Atlas.png")
                },
                {
                    "P10_Hair",
                    CreateLit(
                        "P10_Hair",
                        Color.white,
                        0.05f,
                        0.61f,
                        null,
                        TextureRoot + "/P10_Hair_Atlas.png")
                },
                {
                    "P10_ClothLeather",
                    CreateLit(
                        "P10_ClothLeather",
                        Color.white,
                        0.0f,
                        0.32f,
                        null,
                        TextureRoot + "/P10_ClothLeather_Atlas.png")
                },
                {
                    "P10_Metal",
                    CreateLit(
                        "P10_Metal",
                        Color.white,
                        0.93f,
                        0.77f,
                        null,
                        TextureRoot + "/P10_Metal_Atlas.png")
                },
                {
                    "P10_Glow",
                    CreateLit(
                        "P10_Glow",
                        Color.white,
                        0.18f,
                        0.72f,
                        Html("#32E8F1") * 2.6f,
                        TextureRoot + "/P10_Glow_Atlas.png")
                }
            };
            return result;
        }

        private static GameObject InstantiateHero(
            Scene scene,
            Transform parent,
            Vector3 position,
            Quaternion rotation,
            IReadOnlyDictionary<string, Material> materials,
            bool buildSimplifiedShadowCaster)
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(
                P10CaptureContract.HeroModelAssetPath);
            if (model == null)
            {
                throw new FileNotFoundException(
                    "The authored P10 FBX did not import.",
                    P10CaptureContract.HeroModelAssetPath);
            }

            var wrapper = new GameObject(HeroSceneName);
            SceneManager.MoveGameObjectToScene(wrapper, scene);
            wrapper.transform.SetParent(parent, true);
            wrapper.transform.position = position;
            wrapper.transform.rotation = rotation;
            wrapper.transform.localScale = Vector3.one;

            var modelInstance =
                PrefabUtility.InstantiatePrefab(model, scene) as GameObject;
            if (modelInstance == null)
            {
                throw new InvalidOperationException(
                    "Unity could not instantiate the authored P10 FBX.");
            }

            modelInstance.name = "P10_AstraVale_Model";
            modelInstance.transform.SetParent(wrapper.transform, false);
            modelInstance.transform.localPosition = Vector3.zero;
            modelInstance.transform.localRotation = Quaternion.identity;
            modelInstance.transform.localScale = Vector3.one;

            var marker = wrapper.AddComponent<P10HeroMarker>();
            marker.Configure(
                "P10_ASTRA_VALE_ORIGINAL",
                P10CaptureContract.HeroModelAssetPath,
                P10CaptureContract.Seed);

            var materialUse = new HashSet<string>(StringComparer.Ordinal);
            foreach (var renderer in
                     modelInstance.GetComponentsInChildren<Renderer>(true))
            {
                var assigned = renderer.sharedMaterials;
                for (var index = 0; index < assigned.Length; index++)
                {
                    var sourceName = NormalizeMaterialName(
                        assigned[index] != null ? assigned[index].name : string.Empty);
                    Material target;
                    if (!materials.TryGetValue(sourceName, out target))
                    {
                        throw new InvalidOperationException(
                            "FBX renderer '" +
                            renderer.name +
                            "' references unexpected material '" +
                            sourceName +
                            "'.");
                    }

                    assigned[index] = target;
                    materialUse.Add(sourceName);
                }

                renderer.sharedMaterials = assigned;
                renderer.shadowCastingMode = ShadowCastingMode.Off;
                renderer.receiveShadows = true;
                renderer.lightProbeUsage = LightProbeUsage.Off;
                renderer.reflectionProbeUsage = ReflectionProbeUsage.Off;
            }

            var required = new[]
            {
                "P10_Skin",
                "P10_Hair",
                "P10_ClothLeather",
                "P10_Metal",
                "P10_Glow"
            };
            foreach (var requiredName in required)
            {
                if (!materialUse.Contains(requiredName))
                {
                    throw new InvalidOperationException(
                        "The imported hero does not use required material " +
                        requiredName +
                        ".");
                }
            }

            if (buildSimplifiedShadowCaster)
            {
                BuildShadowCaster(wrapper);
            }

            return wrapper;
        }

        private static void BuildShadowCaster(GameObject heroRoot)
        {
            var shadowObject = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            shadowObject.name = "P10 SHADOW CASTER — unified hero silhouette";
            shadowObject.transform.SetParent(heroRoot.transform, false);
            shadowObject.transform.localPosition =
                new Vector3(0.0f, 1.45f, 0.0f);
            shadowObject.transform.localRotation = Quaternion.identity;
            shadowObject.transform.localScale =
                new Vector3(0.55f, 1.45f, 0.38f);
            var collider = shadowObject.GetComponent<Collider>();
            if (collider != null)
            {
                Object.DestroyImmediate(collider);
            }

            var renderer = shadowObject.GetComponent<Renderer>();
            renderer.sharedMaterial = CreateLit(
                "P10_ShadowCaster",
                Color.black,
                0.0f,
                0.0f);
            renderer.shadowCastingMode = ShadowCastingMode.ShadowsOnly;
            renderer.receiveShadows = false;
            renderer.lightProbeUsage = LightProbeUsage.Off;
            renderer.reflectionProbeUsage = ReflectionProbeUsage.Off;
        }

        private static void ConfigureModelImporter()
        {
            AssetDatabase.ImportAsset(
                P10CaptureContract.HeroModelAssetPath,
                ImportAssetOptions.ForceSynchronousImport |
                ImportAssetOptions.ForceUpdate);
            var importer = AssetImporter.GetAtPath(
                P10CaptureContract.HeroModelAssetPath) as ModelImporter;
            if (importer == null)
            {
                throw new InvalidOperationException(
                    "P10 hero is not handled by Unity's ModelImporter.");
            }

            importer.globalScale = 1.0f;
            importer.useFileUnits = true;
            importer.bakeAxisConversion = false;
            importer.importCameras = false;
            importer.importLights = false;
            importer.importAnimation = false;
            importer.animationType = ModelImporterAnimationType.None;
            importer.importBlendShapes = false;
            importer.importNormals = ModelImporterNormals.Import;
            importer.importTangents = ModelImporterTangents.CalculateMikk;
            importer.meshCompression = ModelImporterMeshCompression.Off;
            importer.isReadable = false;
            importer.optimizeMeshPolygons = true;
            importer.optimizeMeshVertices = true;
            importer.addCollider = false;
            importer.SaveAndReimport();
        }

        private static void ConfigureContract(Scene scene)
        {
            ReviewSceneContract contract = null;
            foreach (var root in scene.GetRootGameObjects())
            {
                contract = root.GetComponentInChildren<ReviewSceneContract>(true);
                if (contract != null)
                {
                    break;
                }
            }

            if (contract == null)
            {
                throw new InvalidOperationException(
                    "The cloned review scene lost ReviewSceneContract.");
            }

            contract.gameObject.name = "P10_CAPTURE_CONTRACT";
            contract.Configure(
                P10CaptureContract.Piece,
                P10CaptureContract.Round,
                P10CaptureContract.Preset,
                P10CaptureContract.Seed,
                new Vector2Int(P10CaptureContract.Width, P10CaptureContract.Height));
            EditorUtility.SetDirty(contract);
        }

        private static Camera FindReviewCamera(Scene scene)
        {
            foreach (var root in scene.GetRootGameObjects())
            {
                var cameras = root.GetComponentsInChildren<Camera>(true);
                foreach (var camera in cameras)
                {
                    if (camera.gameObject.name.StartsWith(
                            "REVIEW CAMERA",
                            StringComparison.Ordinal))
                    {
                        return camera;
                    }
                }
            }

            throw new InvalidOperationException(
                "The cloned review scene lost its S01 camera.");
        }

        public static void ValidateLockedCamera(Camera camera)
        {
            if (camera == null)
            {
                throw new ArgumentNullException(nameof(camera));
            }

            RequireClose(
                "camera.position",
                camera.transform.position,
                new Vector3(
                    P10CaptureContract.CameraPositionX,
                    P10CaptureContract.CameraPositionY,
                    P10CaptureContract.CameraPositionZ));
            RequireClose(
                "camera.rotation",
                camera.transform.rotation,
                new Quaternion(
                    P10CaptureContract.CameraRotationX,
                    P10CaptureContract.CameraRotationY,
                    P10CaptureContract.CameraRotationZ,
                    P10CaptureContract.CameraRotationW));
            RequireClose(
                "camera.fieldOfView",
                camera.fieldOfView,
                P10CaptureContract.CameraFieldOfView);
            RequireClose(
                "camera.nearClipPlane",
                camera.nearClipPlane,
                P10CaptureContract.CameraNearClip);
            RequireClose(
                "camera.farClipPlane",
                camera.farClipPlane,
                P10CaptureContract.CameraFarClip);
            if (camera.clearFlags != CameraClearFlags.Skybox ||
                !camera.allowHDR ||
                !camera.allowMSAA ||
                camera.useOcclusionCulling)
            {
                throw new InvalidOperationException(
                    "The P10 S01 camera render contract drifted.");
            }

            var data = camera.GetUniversalAdditionalCameraData();
            if (!data.renderPostProcessing ||
                data.antialiasing !=
                AntialiasingMode.SubpixelMorphologicalAntiAliasing ||
                data.antialiasingQuality != AntialiasingQuality.High ||
                !data.dithering)
            {
                throw new InvalidOperationException(
                    "The P10 S01 URP camera settings drifted.");
            }
        }

        private static Camera BuildTurntableScene(
            IReadOnlyDictionary<string, Material> heroMaterials)
        {
            var scene = EditorSceneManager.NewScene(
                NewSceneSetup.EmptyScene,
                NewSceneMode.Single);
            scene.name = "P10_HeroTurntable";
            RenderSettings.skybox = null;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientIntensity = 1.0f;
            RenderSettings.ambientSkyColor = Html("#B7C7CF");
            RenderSettings.ambientEquatorColor = Html("#6C7D85");
            RenderSettings.ambientGroundColor = Html("#31383E");
            RenderSettings.fog = false;
            RenderSettings.reflectionIntensity = 0.58f;
            RenderSettings.subtractiveShadowColor = Html("#1A2025");

            var contractObject = new GameObject("P10_TURNTABLE_CONTRACT");
            var contract = contractObject.AddComponent<ReviewSceneContract>();
            contract.Configure(
                P10CaptureContract.Piece,
                P10CaptureContract.Round,
                "NeutralTurntable",
                P10CaptureContract.Seed,
                new Vector2Int(P10CaptureContract.Width, P10CaptureContract.Height));

            var stage = new GameObject("NEUTRAL STUDIO — isolated hero proof");
            var floorMaterial = CreateLit(
                "P10_StudioFloor",
                Html("#465059"),
                0.08f,
                0.55f);
            CreatePrimitive(
                "Neutral floor",
                PrimitiveType.Cylinder,
                stage.transform,
                new Vector3(0.0f, -0.12f, 0.0f),
                new Vector3(3.8f, 0.10f, 3.8f),
                floorMaterial);

            var hero = InstantiateHero(
                scene,
                stage.transform,
                Vector3.zero,
                Quaternion.identity,
                heroMaterials,
                true);
            hero.name = HeroSceneName + " — TURNTABLE";

            var lighting = new GameObject("NEUTRAL LIGHTING — key fill rim");
            var key = CreateLight(
                "Neutral key",
                LightType.Spot,
                lighting.transform,
                new Vector3(-3.6f, 5.8f, -4.5f),
                Html("#FFF0D8"),
                920.0f,
                14.0f,
                52.0f,
                LightShadows.Soft);
            key.transform.LookAt(new Vector3(0.0f, 1.75f, 0.0f));
            key.shadowStrength = 0.68f;

            var fill = CreateLight(
                "Neutral fill",
                LightType.Spot,
                lighting.transform,
                new Vector3(4.5f, 3.8f, -2.2f),
                Html("#C1E8F4"),
                620.0f,
                13.0f,
                64.0f,
                LightShadows.None);
            fill.transform.LookAt(new Vector3(0.0f, 1.7f, 0.0f));

            var rim = CreateLight(
                "Neutral rim",
                LightType.Spot,
                lighting.transform,
                new Vector3(1.5f, 5.2f, 4.0f),
                Html("#C8FBFF"),
                860.0f,
                12.0f,
                46.0f,
                LightShadows.None);
            rim.transform.LookAt(new Vector3(0.0f, 2.0f, 0.0f));

            CreateLight(
                "Neutral top",
                LightType.Directional,
                lighting.transform,
                Vector3.zero,
                Html("#FFFFFF"),
                0.62f,
                100.0f,
                0.0f,
                LightShadows.Soft).transform.rotation =
                Quaternion.Euler(48.0f, -28.0f, 0.0f);

            BuildTurntableVolume(lighting.transform);
            var cameraObject = new GameObject("P10 TURNTABLE CAMERA");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.position = new Vector3(0.0f, 1.95f, 8.2f);
            cameraObject.transform.LookAt(
                new Vector3(
                    P10CaptureContract.TurntableTargetX,
                    P10CaptureContract.TurntableTargetY,
                    P10CaptureContract.TurntableTargetZ));
            var camera = cameraObject.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Html("#202A32");
            camera.fieldOfView = P10CaptureContract.TurntableFieldOfView;
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 50.0f;
            camera.allowHDR = true;
            camera.allowMSAA = true;
            camera.useOcclusionCulling = false;
            var data = camera.GetUniversalAdditionalCameraData();
            data.renderPostProcessing = true;
            data.antialiasing =
                AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            data.antialiasingQuality = AntialiasingQuality.High;
            data.dithering = true;
            cameraObject.AddComponent<AudioListener>();

            EditorSceneManager.MarkSceneDirty(scene);
            if (!EditorSceneManager.SaveScene(
                    scene,
                    P10CaptureContract.TurntableSceneAssetPath))
            {
                throw new InvalidOperationException(
                    "Unity did not save the P10 neutral turntable scene.");
            }

            return camera;
        }

        private static VolumeProfile BuildCinematicVolumeProfile()
        {
            var profile = ResetPersistedProfile(
                CinematicProfilePath,
                "P10_S01_CinematicVolume");
            var tonemapping = AddPersistedComponent<Tonemapping>(profile);
            tonemapping.mode.Override(TonemappingMode.ACES);

            var color = AddPersistedComponent<ColorAdjustments>(profile);
            color.postExposure.Override(0.15f);
            color.contrast.Override(17.0f);
            color.saturation.Override(-5.0f);
            color.hueShift.Override(-2.0f);
            color.colorFilter.Override(Html("#F4F0E5"));

            var whiteBalance = AddPersistedComponent<WhiteBalance>(profile);
            whiteBalance.temperature.Override(-3.0f);
            whiteBalance.tint.Override(2.0f);

            var bloom = AddPersistedComponent<Bloom>(profile);
            bloom.threshold.Override(0.88f);
            bloom.intensity.Override(0.34f);
            bloom.scatter.Override(0.62f);
            bloom.clamp.Override(5.0f);

            var vignette = AddPersistedComponent<Vignette>(profile);
            vignette.color.Override(Html("#071119"));
            vignette.intensity.Override(0.22f);
            vignette.smoothness.Override(0.47f);
            vignette.rounded.Override(false);
            SavePersistedProfile(profile, CinematicProfilePath);
            return profile;
        }

        private static void ReplaceCinematicVolumeProfile(
            Scene scene,
            VolumeProfile profile)
        {
            var volume = scene.GetRootGameObjects()
                .SelectMany(root => root.GetComponentsInChildren<Volume>(true))
                .SingleOrDefault(
                    item => string.Equals(
                        item.gameObject.name,
                        "Global volume — restrained ACES grade",
                        StringComparison.Ordinal));
            if (volume == null)
            {
                throw new InvalidOperationException(
                    "The cloned P00 cinematic volume was not found.");
            }

            volume.sharedProfile = profile;
            EditorUtility.SetDirty(volume);
        }

        private static void BuildTurntableVolume(Transform parent)
        {
            var profile = ResetPersistedProfile(
                TurntableProfilePath,
                "P10_TurntableVolume");
            var tonemapping = AddPersistedComponent<Tonemapping>(profile);
            tonemapping.mode.Override(TonemappingMode.ACES);
            var adjustments = AddPersistedComponent<ColorAdjustments>(profile);
            adjustments.postExposure.Override(0.20f);
            adjustments.contrast.Override(8.0f);
            adjustments.saturation.Override(-1.0f);
            adjustments.colorFilter.Override(Html("#FFF8EE"));
            var bloom = AddPersistedComponent<Bloom>(profile);
            bloom.threshold.Override(1.1f);
            bloom.intensity.Override(0.18f);
            bloom.scatter.Override(0.45f);
            var vignette = AddPersistedComponent<Vignette>(profile);
            vignette.color.Override(Html("#11181D"));
            vignette.intensity.Override(0.12f);
            vignette.smoothness.Override(0.42f);
            SavePersistedProfile(profile, TurntableProfilePath);

            var volumeObject = new GameObject("Neutral global volume");
            volumeObject.transform.SetParent(parent, false);
            var volume = volumeObject.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.priority = 30.0f;
            volume.sharedProfile = profile;
        }

        private static VolumeProfile ResetPersistedProfile(
            string path,
            string name)
        {
            var profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(path);
            if (profile == null)
            {
                profile = ScriptableObject.CreateInstance<VolumeProfile>();
                profile.name = name;
                AssetDatabase.CreateAsset(profile, path);
            }

            foreach (var component in profile.components.ToArray())
            {
                if (component != null)
                {
                    Object.DestroyImmediate(component, true);
                }
            }

            profile.components.Clear();
            profile.name = name;
            return profile;
        }

        private static T AddPersistedComponent<T>(VolumeProfile profile)
            where T : VolumeComponent
        {
            var component = ScriptableObject.CreateInstance<T>();
            component.name = typeof(T).Name;
            component.active = true;
            profile.components.Add(component);
            AssetDatabase.AddObjectToAsset(component, profile);
            EditorUtility.SetDirty(component);
            return component;
        }

        private static void SavePersistedProfile(
            VolumeProfile profile,
            string path)
        {
            EditorUtility.SetDirty(profile);
            AssetDatabase.SaveAssets();
            AssetDatabase.ImportAsset(
                path,
                ImportAssetOptions.ForceSynchronousImport |
                ImportAssetOptions.ForceUpdate);
        }

        public static string ComputeFrozenEnvironmentHash(Scene scene)
        {
            return P00CaptureContract.Sha256(
                Encoding.UTF8.GetBytes(
                    BuildFrozenEnvironmentSignature(scene)));
        }

        private static string BuildFrozenEnvironmentSignature(Scene scene)
        {
            var canonical = new StringBuilder();
            canonical
                .Append("renderSettings=")
                .Append(RenderSettings.ambientMode).Append('|')
                .Append(Float(RenderSettings.ambientIntensity)).Append('|')
                .Append(ColorValue(RenderSettings.ambientSkyColor)).Append('|')
                .Append(ColorValue(RenderSettings.ambientEquatorColor)).Append('|')
                .Append(ColorValue(RenderSettings.ambientGroundColor)).Append('|')
                .Append(RenderSettings.fog).Append('|')
                .Append(RenderSettings.fogMode).Append('|')
                .Append(ColorValue(RenderSettings.fogColor)).Append('|')
                .Append(Float(RenderSettings.fogDensity)).Append('|')
                .Append(Float(RenderSettings.reflectionIntensity)).Append('|')
                .Append(RenderSettings.skybox != null
                    ? AssetDatabase.GetAssetPath(RenderSettings.skybox)
                    : "null")
                .Append('\n');
            var roots = scene.GetRootGameObjects()
                .Where(root => !IsExcludedFromFrozenEnvironment(root))
                .OrderBy(root => root.name, StringComparer.Ordinal)
                .ToArray();
            foreach (var root in roots)
            {
                AppendObjectSignature(root, canonical, string.Empty);
            }

            return canonical.ToString();
        }

        private static bool IsExcludedFromFrozenEnvironment(GameObject gameObject)
        {
            return
                gameObject.name.EndsWith(
                    "CAPTURE_CONTRACT",
                    StringComparison.Ordinal) ||
                gameObject.name.EndsWith(
                    "TURNTABLE_CONTRACT",
                    StringComparison.Ordinal) ||
                gameObject.name.StartsWith("P00_", StringComparison.Ordinal) &&
                gameObject.GetComponent<ReviewSceneContract>() != null;
        }

        private static void AppendObjectSignature(
            GameObject gameObject,
            StringBuilder canonical,
            string parentPath)
        {
            if (gameObject.name.StartsWith("HERO —", StringComparison.Ordinal) ||
                gameObject.GetComponent<P10HeroMarker>() != null)
            {
                return;
            }

            var path = parentPath + "/" + gameObject.name;
            var transform = gameObject.transform;
            canonical
                .Append("object=").Append(path).Append('\n')
                .Append("active=").Append(gameObject.activeSelf).Append('\n')
                .Append("layer=").Append(gameObject.layer).Append('\n')
                .Append("static=")
                .Append((int)GameObjectUtility.GetStaticEditorFlags(gameObject))
                .Append('\n');
            AppendVector(canonical, "position", transform.localPosition);
            AppendQuaternion(canonical, "rotation", transform.localRotation);
            AppendVector(canonical, "scale", transform.localScale);

            var meshFilter = gameObject.GetComponent<MeshFilter>();
            if (meshFilter != null)
            {
                canonical
                    .Append("mesh=")
                    .Append(meshFilter.sharedMesh != null
                        ? meshFilter.sharedMesh.name
                        : "null")
                    .Append('\n');
            }

            var renderer = gameObject.GetComponent<Renderer>();
            if (renderer != null)
            {
                canonical
                    .Append("renderer=")
                    .Append(renderer.GetType().FullName)
                    .Append('|')
                    .Append(renderer.enabled)
                    .Append('|')
                    .Append(renderer.shadowCastingMode)
                    .Append('|')
                    .Append(renderer.receiveShadows)
                    .Append('\n');
                foreach (var sharedMaterial in renderer.sharedMaterials)
                {
                    canonical
                        .Append("material=")
                        .Append(sharedMaterial != null
                            ? AssetDatabase.GetAssetPath(sharedMaterial) +
                              "|" +
                              sharedMaterial.name
                            : "null")
                        .Append('\n');
                }
            }

            var light = gameObject.GetComponent<Light>();
            if (light != null)
            {
                canonical
                    .Append("light=")
                    .Append(light.type).Append('|')
                    .Append(Float(light.intensity)).Append('|')
                    .Append(Float(light.range)).Append('|')
                    .Append(Float(light.spotAngle)).Append('|')
                    .Append(ColorValue(light.color)).Append('|')
                    .Append(light.shadows)
                    .Append('\n');
            }

            var camera = gameObject.GetComponent<Camera>();
            if (camera != null)
            {
                canonical
                    .Append("camera=")
                    .Append(camera.clearFlags).Append('|')
                    .Append(Float(camera.fieldOfView)).Append('|')
                    .Append(Float(camera.nearClipPlane)).Append('|')
                    .Append(Float(camera.farClipPlane)).Append('|')
                    .Append(camera.allowHDR).Append('|')
                    .Append(camera.allowMSAA).Append('|')
                    .Append(camera.useOcclusionCulling)
                    .Append('\n');
                var data = camera.GetUniversalAdditionalCameraData();
                canonical
                    .Append("urpCamera=")
                    .Append(data.renderPostProcessing).Append('|')
                    .Append(data.antialiasing).Append('|')
                    .Append(data.antialiasingQuality).Append('|')
                    .Append(data.dithering)
                    .Append('\n');
            }

            var volume = gameObject.GetComponent<Volume>();
            if (volume != null)
            {
                var profilePath =
                    string.Equals(
                        gameObject.name,
                        "Global volume — restrained ACES grade",
                        StringComparison.Ordinal)
                        ? "P00_INTENDED_CINEMATIC_GRADE"
                        : volume.sharedProfile != null
                            ? AssetDatabase.GetAssetPath(volume.sharedProfile)
                            : "null";
                if (string.Equals(
                        profilePath,
                        "Assets/CodexOfWar/Review/Profiles/P00_CinematicVolume.asset",
                        StringComparison.Ordinal) ||
                    string.Equals(
                        profilePath,
                        CinematicProfilePath,
                        StringComparison.Ordinal))
                {
                    profilePath = "P00_INTENDED_CINEMATIC_GRADE";
                }

                canonical
                    .Append("volume=")
                    .Append(volume.isGlobal).Append('|')
                    .Append(Float(volume.priority)).Append('|')
                    .Append(profilePath)
                    .Append('\n');
            }

            var particles = gameObject.GetComponent<ParticleSystem>();
            if (particles != null)
            {
                var main = particles.main;
                var emission = particles.emission;
                var shape = particles.shape;
                canonical
                    .Append("particles=")
                    .Append(particles.randomSeed).Append('|')
                    .Append(main.maxParticles).Append('|')
                    .Append(Float(main.duration)).Append('|')
                    .Append(Float(emission.rateOverTime.constant)).Append('|')
                    .Append(shape.shapeType).Append('|')
                    .Append(Float(shape.scale.x)).Append(',')
                    .Append(Float(shape.scale.y)).Append(',')
                    .Append(Float(shape.scale.z))
                    .Append('\n');
            }

            var children = new List<Transform>();
            for (var index = 0; index < transform.childCount; index++)
            {
                children.Add(transform.GetChild(index));
            }

            foreach (var child in children.OrderBy(
                         item => item.gameObject.name,
                         StringComparer.Ordinal))
            {
                AppendObjectSignature(child.gameObject, canonical, path);
            }
        }

        private static Material CreateLit(
            string name,
            Color color,
            float metallic,
            float smoothness,
            Color? emission = null,
            string texturePath = null)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                throw new InvalidOperationException(
                    "URP Lit shader was not found.");
            }

            var path = MaterialRoot + "/" + name + ".mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null)
            {
                material = new Material(shader) { name = name };
                AssetDatabase.CreateAsset(material, path);
            }
            else if (material.shader != shader)
            {
                material.shader = shader;
            }

            material.SetColor("_BaseColor", color);
            material.SetFloat("_Metallic", metallic);
            material.SetFloat("_Smoothness", smoothness);
            material.SetFloat("_Surface", 0.0f);
            material.SetFloat("_ReceiveShadows", 1.0f);
            material.enableInstancing = false;
            material.doubleSidedGI = false;
            if (!string.IsNullOrWhiteSpace(texturePath))
            {
                var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
                if (texture == null)
                {
                    throw new FileNotFoundException(
                        "P10 material atlas did not import.",
                        texturePath);
                }

                material.SetTexture("_BaseMap", texture);
                material.SetTextureScale("_BaseMap", Vector2.one);
                material.SetTextureOffset("_BaseMap", Vector2.zero);
            }
            else
            {
                material.SetTexture("_BaseMap", null);
            }

            if (emission.HasValue)
            {
                material.EnableKeyword("_EMISSION");
                material.SetColor("_EmissionColor", emission.Value);
                if (!string.IsNullOrWhiteSpace(texturePath))
                {
                    material.SetTexture(
                        "_EmissionMap",
                        AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath));
                }
                material.globalIlluminationFlags =
                    MaterialGlobalIlluminationFlags.RealtimeEmissive;
            }
            else
            {
                material.DisableKeyword("_EMISSION");
                material.SetColor("_EmissionColor", Color.black);
                material.SetTexture("_EmissionMap", null);
            }

            EditorUtility.SetDirty(material);
            return material;
        }

        private static GameObject CreatePrimitive(
            string name,
            PrimitiveType type,
            Transform parent,
            Vector3 position,
            Vector3 scale,
            Material material,
            Quaternion? rotation = null)
        {
            var gameObject = GameObject.CreatePrimitive(type);
            gameObject.name = name;
            gameObject.transform.SetParent(parent, true);
            gameObject.transform.position = position;
            gameObject.transform.rotation = rotation ?? Quaternion.identity;
            gameObject.transform.localScale = scale;
            var collider = gameObject.GetComponent<Collider>();
            if (collider != null)
            {
                Object.DestroyImmediate(collider);
            }

            var renderer = gameObject.GetComponent<Renderer>();
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = ShadowCastingMode.On;
            renderer.receiveShadows = true;
            return gameObject;
        }

        private static Light CreateLight(
            string name,
            LightType type,
            Transform parent,
            Vector3 position,
            Color color,
            float intensity,
            float range,
            float spotAngle,
            LightShadows shadows)
        {
            var gameObject = new GameObject(name);
            gameObject.transform.SetParent(parent, false);
            gameObject.transform.position = position;
            var light = gameObject.AddComponent<Light>();
            light.type = type;
            light.color = color;
            light.intensity = intensity;
            light.range = range;
            light.spotAngle = spotAngle;
            light.shadows = shadows;
            light.renderMode = LightRenderMode.ForcePixel;
            return light;
        }

        private static GameObject FindByExactName(Scene scene, string name)
        {
            foreach (var root in scene.GetRootGameObjects())
            {
                foreach (var transform in root.GetComponentsInChildren<Transform>(true))
                {
                    if (string.Equals(
                            transform.gameObject.name,
                            name,
                            StringComparison.Ordinal))
                    {
                        return transform.gameObject;
                    }
                }
            }

            return null;
        }

        private static string NormalizeMaterialName(string value)
        {
            var normalized = value.Replace(" (Instance)", string.Empty);
            var dotIndex = normalized.LastIndexOf('.');
            if (dotIndex > 0 &&
                normalized.Length - dotIndex == 4 &&
                normalized.Skip(dotIndex + 1).All(char.IsDigit))
            {
                normalized = normalized.Substring(0, dotIndex);
            }

            return normalized;
        }

        private static void EnsureFolders()
        {
            EnsureFolder("Assets", "CodexOfWar");
            EnsureFolder("Assets/CodexOfWar", "Heroes");
            EnsureFolder("Assets/CodexOfWar/Heroes", "P10");
            EnsureFolder("Assets/CodexOfWar/Heroes/P10", "Models");
            EnsureFolder("Assets/CodexOfWar/Heroes/P10", "Materials");
            EnsureFolder("Assets/CodexOfWar/Heroes/P10", "Textures");
            EnsureFolder("Assets/CodexOfWar", "Review");
            EnsureFolder(ReviewRoot, "Profiles");
            EnsureFolder(ReviewRoot, "Scenes");
        }

        private static void EnsureFolder(string parent, string folderName)
        {
            var path = parent + "/" + folderName;
            if (!AssetDatabase.IsValidFolder(path))
            {
                AssetDatabase.CreateFolder(parent, folderName);
            }
        }

        private static void RequireClose(
            string label,
            Vector3 actual,
            Vector3 expected)
        {
            if ((actual - expected).sqrMagnitude > 0.0000001f)
            {
                throw new InvalidOperationException(
                    label + " drifted: " + actual + " != " + expected);
            }
        }

        private static void RequireClose(
            string label,
            Quaternion actual,
            Quaternion expected)
        {
            if (Quaternion.Angle(actual, expected) > 0.001f)
            {
                throw new InvalidOperationException(
                    label + " drifted: " + actual + " != " + expected);
            }
        }

        private static void RequireClose(
            string label,
            float actual,
            float expected)
        {
            if (Mathf.Abs(actual - expected) > 0.0001f)
            {
                throw new InvalidOperationException(
                    string.Format(
                        CultureInfo.InvariantCulture,
                        "{0} drifted: {1:R} != {2:R}",
                        label,
                        actual,
                        expected));
            }
        }

        private static void AppendVector(
            StringBuilder canonical,
            string label,
            Vector3 value)
        {
            canonical
                .Append(label).Append('=')
                .Append(Float(value.x)).Append(',')
                .Append(Float(value.y)).Append(',')
                .Append(Float(value.z)).Append('\n');
        }

        private static void AppendQuaternion(
            StringBuilder canonical,
            string label,
            Quaternion value)
        {
            canonical
                .Append(label).Append('=')
                .Append(Float(value.x)).Append(',')
                .Append(Float(value.y)).Append(',')
                .Append(Float(value.z)).Append(',')
                .Append(Float(value.w)).Append('\n');
        }

        private static string ColorValue(Color value)
        {
            return string.Join(
                ",",
                Float(value.r),
                Float(value.g),
                Float(value.b),
                Float(value.a));
        }

        private static string Float(float value)
        {
            return value.ToString("R", CultureInfo.InvariantCulture);
        }

        private static Color Html(string value)
        {
            Color color;
            if (!ColorUtility.TryParseHtmlString(value, out color))
            {
                throw new ArgumentException("Invalid HTML color: " + value);
            }

            return color;
        }

        private static string GetRepositoryRoot()
        {
            return Path.GetFullPath(Path.Combine(Application.dataPath, "..", ".."));
        }

        private static string RepositoryPath(string root, string relative)
        {
            return Path.GetFullPath(
                Path.Combine(
                    root,
                    relative.Replace('/', Path.DirectorySeparatorChar)));
        }

        public sealed class BuildResult
        {
            public Camera ReviewCamera;
            public Camera TurntableCamera;
            public GameObject Hero;
            public string P00SceneSha256Before;
            public string P00SceneSha256After;
            public string FrozenEnvironmentSha256P00;
            public string FrozenEnvironmentSha256P10;
        }
    }
}
