using System;
using CodexOfWar.Review;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using Object = UnityEngine.Object;
using Random = System.Random;

namespace CodexOfWar.Editor.Review
{
    public static class P00ReviewSceneBuilder
    {
        private const string ReviewRoot = "Assets/CodexOfWar/Review";
        private const string MaterialRoot = ReviewRoot + "/Materials";
        private const string ProfileRoot = ReviewRoot + "/Profiles";
        private const string SceneRoot = ReviewRoot + "/Scenes";
        private const string VolumeProfilePath =
            ProfileRoot + "/P00_CinematicVolume.asset";
        private const string SkyboxPath = MaterialRoot + "/P00_Skybox.mat";

        private static readonly Color DeepSlate = Html("#17212B");
        private static readonly Color WetStone = Html("#455864");
        private static readonly Color Sandstone = Html("#806B55");
        private static readonly Color Moss = Html("#52654E");
        private static readonly Color TealCloth = Html("#1D6873");
        private static readonly Color HeroArmor = Html("#385166");
        private static readonly Color Bronze = Html("#CB8A42");
        private static readonly Color WarmSkin = Html("#CF9273");
        private static readonly Color DarkHair = Html("#11171D");
        private static readonly Color Linen = Html("#D0BE99");
        private static readonly Color ZombieSkin = Html("#879775");
        private static readonly Color ZombieCloth = Html("#70483F");
        private static readonly Color Ember = Html("#FF8D39");
        private static readonly Color CyanGlow = Html("#55D6D0");

        [MenuItem("Codex of War/Review/Build P00 Evidence Scene")]
        public static Camera BuildAndSave()
        {
            EnsureFolder("Assets", "CodexOfWar");
            EnsureFolder("Assets/CodexOfWar", "Review");
            EnsureFolder(ReviewRoot, "Materials");
            EnsureFolder(ReviewRoot, "Profiles");
            EnsureFolder(ReviewRoot, "Scenes");

            UnityEngine.Random.InitState(P00CaptureContract.Seed);
            var random = new Random(P00CaptureContract.Seed);
            var materials = CreateMaterials();
            var scene = EditorSceneManager.NewScene(
                NewSceneSetup.EmptyScene,
                NewSceneMode.Single);
            scene.name = "P00_EvidenceSpine";

            ConfigureEnvironment(materials.Skybox);

            var contractObject = new GameObject("P00_CAPTURE_CONTRACT");
            var contract = contractObject.AddComponent<ReviewSceneContract>();
            contract.Configure(
                P00CaptureContract.Piece,
                P00CaptureContract.Round,
                P00CaptureContract.Preset,
                P00CaptureContract.Seed,
                new Vector2Int(
                    P00CaptureContract.Width,
                    P00CaptureContract.Height));

            var arenaRoot = new GameObject("ARENA — foreground · stage · horizon");
            BuildArena(arenaRoot.transform, materials, random);

            var castRoot = new GameObject("CAST — hero · zombie");
            var hero = BuildHero(castRoot.transform, materials);
            var zombie = BuildZombie(castRoot.transform, materials);
            FaceToward(hero, zombie.position + Vector3.up * 1.25f);
            FaceToward(zombie, hero.position + Vector3.up * 1.2f);

            var lightRoot = new GameObject("LIGHTING — key · fill · rims · practicals");
            BuildLighting(lightRoot.transform, hero, zombie);
            BuildCinematicVolume(lightRoot.transform);

            var camera = BuildCamera(hero, zombie);
            BuildAtmosphere(arenaRoot.transform, materials, random);

            EditorSceneManager.MarkSceneDirty(scene);
            if (!EditorSceneManager.SaveScene(scene, P00CaptureContract.SceneAssetPath))
            {
                throw new InvalidOperationException(
                    "Unity did not save the P00 review scene.");
            }

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            Selection.activeObject = camera.gameObject;
            Debug.Log(
                "[P00] Deterministic review scene saved to " +
                P00CaptureContract.SceneAssetPath);
            return camera;
        }

        private static SceneMaterials CreateMaterials()
        {
            return new SceneMaterials
            {
                Skybox = CreateSkybox(),
                Stone = CreateLit(
                    "P00_Stone",
                    DeepSlate,
                    0.05f,
                    0.24f),
                WetStone = CreateLit(
                    "P00_WetStone",
                    WetStone,
                    0.15f,
                    0.58f),
                Sandstone = CreateLit(
                    "P00_Sandstone",
                    Sandstone,
                    0.0f,
                    0.19f),
                Moss = CreateLit("P00_Moss", Moss, 0.0f, 0.12f),
                HeroCloth = CreateLit(
                    "P00_HeroCloth",
                    TealCloth,
                    0.0f,
                    0.36f),
                HeroArmor = CreateLit(
                    "P00_HeroArmor",
                    HeroArmor,
                    0.68f,
                    0.73f),
                Bronze = CreateLit(
                    "P00_Bronze",
                    Bronze,
                    0.82f,
                    0.71f),
                HeroSkin = CreateLit(
                    "P00_HeroSkin",
                    WarmSkin,
                    0.0f,
                    0.42f),
                Hair = CreateLit("P00_Hair", DarkHair, 0.0f, 0.29f),
                Linen = CreateLit("P00_Linen", Linen, 0.0f, 0.21f),
                ZombieSkin = CreateLit(
                    "P00_ZombieSkin",
                    ZombieSkin,
                    0.0f,
                    0.33f),
                ZombieCloth = CreateLit(
                    "P00_ZombieCloth",
                    ZombieCloth,
                    0.0f,
                    0.17f),
                Ember = CreateLit(
                    "P00_Ember",
                    Html("#8C321E"),
                    0.0f,
                    0.25f,
                    Ember * 3.5f),
                CyanGlow = CreateLit(
                    "P00_CyanGlow",
                    Html("#174848"),
                    0.0f,
                    0.35f,
                    CyanGlow * 2.2f),
                Dust = CreateParticleMaterial()
            };
        }

        private static Material CreateSkybox()
        {
            var shader = Shader.Find("Skybox/Procedural");
            if (shader == null)
            {
                throw new InvalidOperationException(
                    "Required built-in procedural skybox shader was not found.");
            }

            var material = LoadOrCreateMaterial(SkyboxPath, shader);
            SetColor(material, "_SkyTint", Html("#52697A"));
            SetColor(material, "_GroundColor", Html("#20242B"));
            SetFloat(material, "_AtmosphereThickness", 0.82f);
            SetFloat(material, "_SunSize", 0.025f);
            SetFloat(material, "_SunSizeConvergence", 4.5f);
            SetFloat(material, "_Exposure", 0.78f);
            EditorUtility.SetDirty(material);
            return material;
        }

        private static Material CreateLit(
            string name,
            Color color,
            float metallic,
            float smoothness,
            Color? emission = null)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                throw new InvalidOperationException(
                    "URP Lit shader was not found. P00 capture cannot continue.");
            }

            var path = MaterialRoot + "/" + name + ".mat";
            var material = LoadOrCreateMaterial(path, shader);
            SetColor(material, "_BaseColor", color);
            SetFloat(material, "_Metallic", metallic);
            SetFloat(material, "_Smoothness", smoothness);
            SetFloat(material, "_Surface", 0.0f);
            SetFloat(material, "_ReceiveShadows", 1.0f);

            if (emission.HasValue)
            {
                material.EnableKeyword("_EMISSION");
                SetColor(material, "_EmissionColor", emission.Value);
                material.globalIlluminationFlags =
                    MaterialGlobalIlluminationFlags.RealtimeEmissive;
            }
            else
            {
                material.DisableKeyword("_EMISSION");
                SetColor(material, "_EmissionColor", Color.black);
            }

            EditorUtility.SetDirty(material);
            return material;
        }

        private static Material CreateParticleMaterial()
        {
            var shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (shader == null)
            {
                shader = Shader.Find("Universal Render Pipeline/Unlit");
            }

            if (shader == null)
            {
                throw new InvalidOperationException(
                    "A compatible URP unlit shader was not found.");
            }

            var material = LoadOrCreateMaterial(
                MaterialRoot + "/P00_Dust.mat",
                shader);
            SetColor(material, "_BaseColor", Html("#C8A67A"));
            SetFloat(material, "_Surface", 1.0f);
            SetFloat(material, "_Blend", 0.0f);
            SetFloat(material, "_AlphaClip", 0.0f);
            material.renderQueue = (int)RenderQueue.Transparent;
            EditorUtility.SetDirty(material);
            return material;
        }

        private static Material LoadOrCreateMaterial(string path, Shader shader)
        {
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null)
            {
                material = new Material(shader)
                {
                    name = System.IO.Path.GetFileNameWithoutExtension(path)
                };
                AssetDatabase.CreateAsset(material, path);
            }
            else if (material.shader != shader)
            {
                material.shader = shader;
            }

            return material;
        }

        private static void ConfigureEnvironment(Material skybox)
        {
            RenderSettings.skybox = skybox;
            RenderSettings.sun = null;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientIntensity = 1.10f;
            RenderSettings.ambientSkyColor = Html("#7893A4");
            RenderSettings.ambientEquatorColor = Html("#52616A");
            RenderSettings.ambientGroundColor = Html("#293139");
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = Html("#394B54");
            RenderSettings.fogDensity = 0.0115f;
            RenderSettings.reflectionIntensity = 0.62f;
            RenderSettings.subtractiveShadowColor = Html("#111A22");
        }

        private static void BuildArena(
            Transform parent,
            SceneMaterials materials,
            Random random)
        {
            var ground = CreatePrimitive(
                "Ground — damp basalt field",
                PrimitiveType.Plane,
                parent,
                new Vector3(0.0f, -0.31f, 11.0f),
                new Vector3(6.0f, 1.0f, 7.0f),
                materials.Stone);
            MakeStatic(ground);

            var stage = CreatePrimitive(
                "Midground — raised combat dais",
                PrimitiveType.Cylinder,
                parent,
                new Vector3(0.0f, -0.20f, 7.0f),
                new Vector3(8.6f, 0.18f, 8.6f),
                materials.WetStone);
            MakeStatic(stage);

            var innerStage = CreatePrimitive(
                "Midground — worn inner ring",
                PrimitiveType.Cylinder,
                parent,
                new Vector3(0.0f, -0.01f, 7.0f),
                new Vector3(5.1f, 0.10f, 5.1f),
                materials.Sandstone);
            MakeStatic(innerStage);

            var slabRoot = new GameObject("Midground — radial authored floor slabs");
            slabRoot.transform.SetParent(parent, false);
            for (var index = 0; index < 28; index++)
            {
                var angle = index * Mathf.PI * 2.0f / 28.0f;
                var radius = 6.55f + NextRange(random, -0.2f, 0.2f);
                var position = new Vector3(
                    Mathf.Sin(angle) * radius,
                    0.12f + NextRange(random, -0.018f, 0.018f),
                    7.0f + Mathf.Cos(angle) * radius);
                var slab = CreatePrimitive(
                    "Ring slab " + index.ToString("00"),
                    PrimitiveType.Cube,
                    slabRoot.transform,
                    position,
                    new Vector3(
                        1.05f + NextRange(random, -0.08f, 0.12f),
                        0.12f,
                        2.25f + NextRange(random, -0.2f, 0.2f)),
                    index % 5 == 0 ? materials.Moss : materials.WetStone,
                    Quaternion.Euler(
                        NextRange(random, -0.8f, 0.8f),
                        angle * Mathf.Rad2Deg,
                        NextRange(random, -0.7f, 0.7f)));
                MakeStatic(slab);
            }

            BuildForeground(parent, materials);
            BuildHorizon(parent, materials, random);
            BuildPracticals(parent, materials);
            BuildDebris(parent, materials, random);
        }

        private static void BuildForeground(
            Transform parent,
            SceneMaterials materials)
        {
            var foreground = new GameObject("Foreground — ruin framing");
            foreground.transform.SetParent(parent, false);

            BuildBrokenColumn(
                foreground.transform,
                new Vector3(-9.3f, -0.15f, -2.4f),
                4.15f,
                0.78f,
                materials);
            BuildBrokenColumn(
                foreground.transform,
                new Vector3(8.4f, -0.15f, -2.8f),
                3.5f,
                0.85f,
                materials);

            CreatePrimitive(
                "Left lintel fragment",
                PrimitiveType.Cube,
                foreground.transform,
                new Vector3(-7.9f, 3.82f, -1.5f),
                new Vector3(2.55f, 0.42f, 0.78f),
                materials.Sandstone,
                Quaternion.Euler(-7.0f, 8.0f, -12.0f));
            CreatePrimitive(
                "Right foreground boulder",
                PrimitiveType.Sphere,
                foreground.transform,
                new Vector3(7.2f, 0.2f, -0.2f),
                new Vector3(2.4f, 1.2f, 1.7f),
                materials.Moss,
                Quaternion.Euler(0.0f, 18.0f, -9.0f));
            CreatePrimitive(
                "Left foreground boulder",
                PrimitiveType.Sphere,
                foreground.transform,
                new Vector3(-6.0f, -0.1f, -1.0f),
                new Vector3(2.1f, 0.85f, 1.25f),
                materials.WetStone,
                Quaternion.Euler(3.0f, -24.0f, 7.0f));
        }

        private static void BuildBrokenColumn(
            Transform parent,
            Vector3 basePosition,
            float height,
            float width,
            SceneMaterials materials)
        {
            CreatePrimitive(
                "Column plinth",
                PrimitiveType.Cylinder,
                parent,
                basePosition + Vector3.up * 0.16f,
                new Vector3(width * 1.35f, 0.16f, width * 1.35f),
                materials.WetStone);
            CreatePrimitive(
                "Column shaft",
                PrimitiveType.Cylinder,
                parent,
                basePosition + Vector3.up * (height * 0.5f + 0.25f),
                new Vector3(width, height * 0.5f, width),
                materials.Sandstone,
                Quaternion.Euler(0.0f, 0.0f, width > 1.0f ? -3.0f : 4.0f));
            CreatePrimitive(
                "Column capital",
                PrimitiveType.Cube,
                parent,
                basePosition + Vector3.up * (height + 0.35f),
                new Vector3(width * 1.65f, 0.35f, width * 1.65f),
                materials.Moss,
                Quaternion.Euler(0.0f, 12.0f, width > 1.0f ? -5.0f : 6.0f));
        }

        private static void BuildHorizon(
            Transform parent,
            SceneMaterials materials,
            Random random)
        {
            var horizon = new GameObject("Background — citadel silhouette");
            horizon.transform.SetParent(parent, false);

            for (var index = 0; index < 11; index++)
            {
                var x = -22.0f + index * 4.4f;
                var height = NextRange(random, 5.0f, 10.5f);
                var depth = NextRange(random, 3.5f, 6.0f);
                CreatePrimitive(
                    "Cliff mass " + index.ToString("00"),
                    PrimitiveType.Cube,
                    horizon.transform,
                    new Vector3(x, height * 0.5f - 0.3f, 35.0f + depth * 0.3f),
                    new Vector3(
                        NextRange(random, 4.1f, 6.0f),
                        height,
                        depth),
                    index % 4 == 0 ? materials.Moss : materials.Stone,
                    Quaternion.Euler(
                        NextRange(random, -2.0f, 2.0f),
                        NextRange(random, -8.0f, 8.0f),
                        NextRange(random, -2.0f, 2.0f)));
            }

            CreatePrimitive(
                "Citadel left tower",
                PrimitiveType.Cube,
                horizon.transform,
                new Vector3(-9.0f, 9.0f, 34.0f),
                new Vector3(4.2f, 17.0f, 5.2f),
                materials.Sandstone);
            CreatePrimitive(
                "Citadel right tower",
                PrimitiveType.Cube,
                horizon.transform,
                new Vector3(9.0f, 8.2f, 35.0f),
                new Vector3(4.8f, 15.5f, 5.5f),
                materials.Sandstone);
            CreatePrimitive(
                "Citadel suspended bridge",
                PrimitiveType.Cube,
                horizon.transform,
                new Vector3(0.0f, 11.2f, 35.0f),
                new Vector3(16.0f, 1.1f, 2.3f),
                materials.WetStone,
                Quaternion.Euler(0.0f, 0.0f, -2.0f));
            CreatePrimitive(
                "Distant spire",
                PrimitiveType.Cylinder,
                horizon.transform,
                new Vector3(2.5f, 15.4f, 39.0f),
                new Vector3(2.2f, 9.2f, 2.2f),
                materials.Stone);
            CreatePrimitive(
                "Distant beacon",
                PrimitiveType.Sphere,
                horizon.transform,
                new Vector3(2.5f, 25.0f, 39.0f),
                new Vector3(0.48f, 0.48f, 0.48f),
                materials.Ember);
        }

        private static void BuildPracticals(
            Transform parent,
            SceneMaterials materials)
        {
            BuildBrazier(
                parent,
                new Vector3(-6.1f, 0.0f, 8.3f),
                materials,
                "Left brazier");
            BuildBrazier(
                parent,
                new Vector3(6.2f, 0.0f, 9.8f),
                materials,
                "Right brazier");
        }

        private static void BuildBrazier(
            Transform parent,
            Vector3 position,
            SceneMaterials materials,
            string name)
        {
            var root = new GameObject(name);
            root.transform.SetParent(parent, false);
            root.transform.position = position;
            CreatePrimitive(
                "Bronze bowl",
                PrimitiveType.Cylinder,
                root.transform,
                new Vector3(position.x, 1.08f, position.z),
                new Vector3(0.62f, 0.16f, 0.62f),
                materials.Bronze);
            CreatePrimitive(
                "Ember core",
                PrimitiveType.Sphere,
                root.transform,
                new Vector3(position.x, 1.34f, position.z),
                new Vector3(0.38f, 0.22f, 0.38f),
                materials.Ember);
            for (var leg = 0; leg < 3; leg++)
            {
                var angle = leg * 120.0f * Mathf.Deg2Rad;
                CreatePrimitive(
                    "Tripod leg " + leg,
                    PrimitiveType.Cylinder,
                    root.transform,
                    new Vector3(
                        position.x + Mathf.Sin(angle) * 0.24f,
                        0.56f,
                        position.z + Mathf.Cos(angle) * 0.24f),
                    new Vector3(0.07f, 0.55f, 0.07f),
                    materials.Bronze,
                    Quaternion.Euler(
                        Mathf.Cos(angle) * 8.0f,
                        0.0f,
                        -Mathf.Sin(angle) * 8.0f));
            }
        }

        private static void BuildDebris(
            Transform parent,
            SceneMaterials materials,
            Random random)
        {
            var debrisRoot = new GameObject("Midground — deterministic debris");
            debrisRoot.transform.SetParent(parent, false);
            for (var index = 0; index < 34; index++)
            {
                var angle = NextRange(random, 0.0f, Mathf.PI * 2.0f);
                var radius = NextRange(random, 9.0f, 20.0f);
                var scale = NextRange(random, 0.18f, 0.75f);
                var debris = CreatePrimitive(
                    "Debris " + index.ToString("00"),
                    index % 4 == 0 ? PrimitiveType.Cylinder : PrimitiveType.Cube,
                    debrisRoot.transform,
                    new Vector3(
                        Mathf.Sin(angle) * radius,
                        -0.08f + scale * 0.15f,
                        8.0f + Mathf.Cos(angle) * radius),
                    new Vector3(
                        scale * NextRange(random, 0.8f, 1.8f),
                        scale * NextRange(random, 0.25f, 0.75f),
                        scale * NextRange(random, 0.7f, 1.6f)),
                    index % 7 == 0 ? materials.Moss : materials.WetStone,
                    Quaternion.Euler(
                        NextRange(random, -15.0f, 15.0f),
                        NextRange(random, 0.0f, 180.0f),
                        NextRange(random, -14.0f, 14.0f)));
                MakeStatic(debris);
            }
        }

        private static Transform BuildHero(
            Transform parent,
            SceneMaterials materials)
        {
            var root = new GameObject("HERO — Sentinel proxy").transform;
            root.SetParent(parent, false);

            CreatePrimitive(
                "Pelvis",
                PrimitiveType.Capsule,
                root,
                new Vector3(0.0f, 1.02f, 0.0f),
                new Vector3(0.55f, 0.42f, 0.46f),
                materials.HeroCloth);
            CreatePrimitive(
                "Armored torso",
                PrimitiveType.Capsule,
                root,
                new Vector3(0.0f, 1.92f, 0.0f),
                new Vector3(0.74f, 0.62f, 0.47f),
                materials.HeroArmor);
            CreatePrimitive(
                "Chest plate",
                PrimitiveType.Cube,
                root,
                new Vector3(0.0f, 2.02f, 0.23f),
                new Vector3(1.18f, 0.66f, 0.22f),
                materials.Bronze,
                Quaternion.Euler(-5.0f, 0.0f, 0.0f));
            CreatePrimitive(
                "Chest cloth inset",
                PrimitiveType.Cube,
                root,
                new Vector3(0.0f, 1.99f, 0.36f),
                new Vector3(0.58f, 0.45f, 0.06f),
                materials.HeroCloth,
                Quaternion.Euler(-5.0f, 0.0f, 0.0f));
            CreatePrimitive(
                "Neck",
                PrimitiveType.Cylinder,
                root,
                new Vector3(0.0f, 2.68f, 0.0f),
                new Vector3(0.22f, 0.16f, 0.22f),
                materials.HeroSkin);
            CreatePrimitive(
                "Head",
                PrimitiveType.Sphere,
                root,
                new Vector3(0.0f, 3.02f, 0.04f),
                new Vector3(0.43f, 0.53f, 0.43f),
                materials.HeroSkin);
            CreatePrimitive(
                "Hair mass",
                PrimitiveType.Sphere,
                root,
                new Vector3(-0.03f, 3.25f, -0.05f),
                new Vector3(0.47f, 0.36f, 0.46f),
                materials.Hair);
            CreatePrimitive(
                "Hair crest",
                PrimitiveType.Capsule,
                root,
                new Vector3(-0.03f, 3.46f, -0.10f),
                new Vector3(0.16f, 0.31f, 0.17f),
                materials.Hair,
                Quaternion.Euler(-16.0f, 0.0f, 0.0f));
            CreatePrimitive(
                "Jaw guard",
                PrimitiveType.Cube,
                root,
                new Vector3(0.0f, 2.90f, 0.35f),
                new Vector3(0.46f, 0.16f, 0.13f),
                materials.Bronze);

            BuildHeroArm(
                root,
                "Left",
                -1.0f,
                new Vector3(-0.70f, 2.18f, 0.02f),
                Quaternion.Euler(0.0f, 0.0f, 17.0f),
                materials);
            BuildHeroArm(
                root,
                "Right",
                1.0f,
                new Vector3(0.72f, 2.12f, 0.02f),
                Quaternion.Euler(11.0f, 0.0f, -13.0f),
                materials);

            BuildHeroLeg(
                root,
                "Left",
                new Vector3(-0.31f, 0.56f, 0.07f),
                Quaternion.Euler(2.0f, 0.0f, -3.0f),
                materials);
            BuildHeroLeg(
                root,
                "Right",
                new Vector3(0.32f, 0.57f, -0.04f),
                Quaternion.Euler(-3.0f, 0.0f, 4.0f),
                materials);

            BuildCape(root, materials);
            BuildSword(root, materials);
            root.position = new Vector3(-1.55f, 0.0f, 0.1f);
            return root;
        }

        private static void BuildHeroArm(
            Transform root,
            string side,
            float sign,
            Vector3 shoulderPosition,
            Quaternion rotation,
            SceneMaterials materials)
        {
            CreatePrimitive(
                side + " shoulder pauldron",
                PrimitiveType.Sphere,
                root,
                shoulderPosition,
                new Vector3(0.48f, 0.39f, 0.50f),
                side == "Left" ? materials.Bronze : materials.HeroArmor);
            CreatePrimitive(
                side + " upper arm",
                PrimitiveType.Capsule,
                root,
                shoulderPosition + new Vector3(sign * 0.27f, -0.48f, 0.02f),
                new Vector3(0.25f, 0.43f, 0.25f),
                materials.HeroCloth,
                rotation);
            CreatePrimitive(
                side + " bracer",
                PrimitiveType.Cylinder,
                root,
                shoulderPosition + new Vector3(sign * 0.37f, -0.94f, 0.05f),
                new Vector3(0.24f, 0.34f, 0.24f),
                materials.Bronze,
                rotation);
            CreatePrimitive(
                side + " hand",
                PrimitiveType.Sphere,
                root,
                shoulderPosition + new Vector3(sign * 0.42f, -1.28f, 0.08f),
                new Vector3(0.22f, 0.25f, 0.21f),
                materials.HeroSkin);
        }

        private static void BuildHeroLeg(
            Transform root,
            string side,
            Vector3 position,
            Quaternion rotation,
            SceneMaterials materials)
        {
            CreatePrimitive(
                side + " leg",
                PrimitiveType.Capsule,
                root,
                position,
                new Vector3(0.32f, 0.57f, 0.32f),
                materials.HeroCloth,
                rotation);
            CreatePrimitive(
                side + " greave",
                PrimitiveType.Cube,
                root,
                position + new Vector3(0.0f, -0.25f, 0.24f),
                new Vector3(0.36f, 0.55f, 0.16f),
                materials.HeroArmor,
                rotation);
            CreatePrimitive(
                side + " boot",
                PrimitiveType.Cube,
                root,
                position + new Vector3(0.0f, -0.53f, 0.20f),
                new Vector3(0.45f, 0.24f, 0.72f),
                materials.Hair,
                rotation);
        }

        private static void BuildCape(
            Transform root,
            SceneMaterials materials)
        {
            for (var segment = 0; segment < 4; segment++)
            {
                var t = segment / 3.0f;
                CreatePrimitive(
                    "Cape panel " + segment,
                    PrimitiveType.Cube,
                    root,
                    new Vector3(
                        -0.36f + segment * 0.24f,
                        1.45f - t * 0.25f,
                        -0.39f - t * 0.07f),
                    new Vector3(0.34f, 1.52f - t * 0.36f, 0.10f),
                    segment == 0 ? materials.Linen : materials.HeroCloth,
                    Quaternion.Euler(8.0f + t * 8.0f, 0.0f, -4.0f + t * 8.0f));
            }
        }

        private static void BuildSword(
            Transform root,
            SceneMaterials materials)
        {
            var weapon = new GameObject("Asymmetrical greatsword").transform;
            weapon.SetParent(root, false);
            weapon.localPosition = new Vector3(0.98f, 1.30f, 0.08f);
            weapon.localRotation = Quaternion.Euler(17.0f, -7.0f, -23.0f);

            CreatePrimitive(
                "Grip",
                PrimitiveType.Cylinder,
                weapon,
                weapon.position,
                new Vector3(0.09f, 0.42f, 0.09f),
                materials.Hair);
            CreatePrimitive(
                "Guard",
                PrimitiveType.Cube,
                weapon,
                weapon.TransformPoint(new Vector3(0.0f, 0.50f, 0.0f)),
                new Vector3(0.92f, 0.11f, 0.15f),
                materials.Bronze,
                weapon.rotation);
            CreatePrimitive(
                "Blade",
                PrimitiveType.Cube,
                weapon,
                weapon.TransformPoint(new Vector3(0.0f, 1.72f, 0.0f)),
                new Vector3(0.30f, 2.35f, 0.12f),
                materials.HeroArmor,
                weapon.rotation);
            CreatePrimitive(
                "Blade inlay",
                PrimitiveType.Cube,
                weapon,
                weapon.TransformPoint(new Vector3(0.0f, 1.75f, 0.08f)),
                new Vector3(0.08f, 1.92f, 0.035f),
                materials.CyanGlow,
                weapon.rotation);
            CreatePrimitive(
                "Pommel",
                PrimitiveType.Sphere,
                weapon,
                weapon.TransformPoint(new Vector3(0.0f, -0.47f, 0.0f)),
                new Vector3(0.17f, 0.17f, 0.17f),
                materials.Bronze);
        }

        private static Transform BuildZombie(
            Transform parent,
            SceneMaterials materials)
        {
            var root = new GameObject("ZOMBIE — Ashbound proxy").transform;
            root.SetParent(parent, false);

            CreatePrimitive(
                "Hunched torso",
                PrimitiveType.Capsule,
                root,
                new Vector3(0.0f, 1.65f, 0.0f),
                new Vector3(0.58f, 0.64f, 0.39f),
                materials.ZombieSkin,
                Quaternion.Euler(16.0f, 0.0f, -5.0f));
            CreatePrimitive(
                "Torn cuirass",
                PrimitiveType.Cube,
                root,
                new Vector3(-0.06f, 1.73f, 0.26f),
                new Vector3(0.82f, 0.64f, 0.16f),
                materials.ZombieCloth,
                Quaternion.Euler(13.0f, 0.0f, -7.0f));
            CreatePrimitive(
                "Head",
                PrimitiveType.Sphere,
                root,
                new Vector3(0.08f, 2.64f, 0.18f),
                new Vector3(0.39f, 0.47f, 0.38f),
                materials.ZombieSkin,
                Quaternion.Euler(12.0f, -8.0f, 9.0f));
            CreatePrimitive(
                "Jaw",
                PrimitiveType.Cube,
                root,
                new Vector3(0.10f, 2.45f, 0.47f),
                new Vector3(0.40f, 0.18f, 0.22f),
                materials.ZombieSkin,
                Quaternion.Euler(8.0f, 0.0f, 8.0f));
            CreatePrimitive(
                "Eye left",
                PrimitiveType.Sphere,
                root,
                new Vector3(-0.08f, 2.72f, 0.48f),
                new Vector3(0.065f, 0.055f, 0.045f),
                materials.Ember);
            CreatePrimitive(
                "Eye right",
                PrimitiveType.Sphere,
                root,
                new Vector3(0.23f, 2.72f, 0.48f),
                new Vector3(0.065f, 0.055f, 0.045f),
                materials.Ember);

            BuildZombieArm(
                root,
                "Claw arm",
                -1.0f,
                new Vector3(-0.52f, 1.91f, 0.07f),
                new Vector3(-0.95f, 1.19f, 0.53f),
                Quaternion.Euler(53.0f, 4.0f, 41.0f),
                materials);
            BuildZombieArm(
                root,
                "Broken arm",
                1.0f,
                new Vector3(0.54f, 1.86f, 0.0f),
                new Vector3(0.87f, 1.31f, -0.18f),
                Quaternion.Euler(-18.0f, 0.0f, -33.0f),
                materials);

            BuildZombieLeg(
                root,
                "Dragging leg",
                new Vector3(-0.28f, 0.63f, -0.08f),
                Quaternion.Euler(-8.0f, 0.0f, -8.0f),
                materials);
            BuildZombieLeg(
                root,
                "Planted leg",
                new Vector3(0.33f, 0.64f, 0.13f),
                Quaternion.Euler(11.0f, 0.0f, 7.0f),
                materials);

            for (var rib = 0; rib < 4; rib++)
            {
                CreatePrimitive(
                    "Exposed rib " + rib,
                    PrimitiveType.Cylinder,
                    root,
                    new Vector3(
                        -0.18f + rib * 0.13f,
                        1.67f - rib * 0.09f,
                        0.46f),
                    new Vector3(0.045f, 0.36f, 0.045f),
                    materials.Linen,
                    Quaternion.Euler(4.0f, 0.0f, 76.0f - rib * 4.0f));
            }

            CreatePrimitive(
                "Tattered sash",
                PrimitiveType.Cube,
                root,
                new Vector3(0.32f, 0.94f, -0.03f),
                new Vector3(0.46f, 0.90f, 0.09f),
                materials.ZombieCloth,
                Quaternion.Euler(7.0f, 0.0f, -14.0f));
            root.position = new Vector3(3.65f, 0.03f, 8.35f);
            return root;
        }

        private static void BuildZombieArm(
            Transform root,
            string name,
            float sign,
            Vector3 shoulder,
            Vector3 hand,
            Quaternion rotation,
            SceneMaterials materials)
        {
            var midpoint = (shoulder + hand) * 0.5f;
            var length = Vector3.Distance(shoulder, hand);
            CreatePrimitive(
                name + " upper",
                PrimitiveType.Capsule,
                root,
                midpoint,
                new Vector3(0.20f, length * 0.47f, 0.19f),
                materials.ZombieSkin,
                rotation);
            CreatePrimitive(
                name + " shoulder wrap",
                PrimitiveType.Sphere,
                root,
                shoulder,
                new Vector3(0.34f, 0.28f, 0.33f),
                sign < 0.0f ? materials.ZombieCloth : materials.ZombieSkin);
            CreatePrimitive(
                name + " claw",
                PrimitiveType.Sphere,
                root,
                hand,
                new Vector3(0.23f, 0.18f, 0.30f),
                materials.ZombieSkin);
            for (var finger = 0; finger < 3; finger++)
            {
                CreatePrimitive(
                    name + " talon " + finger,
                    PrimitiveType.Cylinder,
                    root,
                    hand + new Vector3((finger - 1) * 0.09f, -0.08f, 0.24f),
                    new Vector3(0.025f, 0.16f, 0.025f),
                    materials.Linen,
                    Quaternion.Euler(64.0f, 0.0f, (finger - 1) * 9.0f));
            }
        }

        private static void BuildZombieLeg(
            Transform root,
            string name,
            Vector3 position,
            Quaternion rotation,
            SceneMaterials materials)
        {
            CreatePrimitive(
                name,
                PrimitiveType.Capsule,
                root,
                position,
                new Vector3(0.27f, 0.56f, 0.27f),
                materials.ZombieSkin,
                rotation);
            CreatePrimitive(
                name + " foot",
                PrimitiveType.Cube,
                root,
                position + new Vector3(0.0f, -0.55f, 0.24f),
                new Vector3(0.39f, 0.19f, 0.65f),
                materials.ZombieCloth,
                rotation);
        }

        private static void BuildLighting(
            Transform parent,
            Transform hero,
            Transform zombie)
        {
            var key = CreateLight(
                "Key — warm broken-sky sun",
                LightType.Directional,
                parent,
                Vector3.zero,
                Quaternion.Euler(42.0f, -28.0f, 0.0f),
                Html("#FFD5A8"),
                2.15f,
                100.0f,
                0.0f,
                LightShadows.Soft);
            key.shadowStrength = 0.78f;
            key.shadowBias = 0.04f;
            key.shadowNormalBias = 0.38f;
            RenderSettings.sun = key;

            CreateLight(
                "Fill — cool overcast",
                LightType.Directional,
                parent,
                Vector3.zero,
                Quaternion.Euler(24.0f, 148.0f, 7.0f),
                Html("#7FAFC5"),
                0.74f,
                100.0f,
                0.0f,
                LightShadows.None);

            var heroRim = CreateLight(
                "Hero rim — cyan silhouette",
                LightType.Spot,
                parent,
                new Vector3(3.2f, 6.7f, 5.0f),
                Quaternion.identity,
                Html("#6CD9E0"),
                760.0f,
                22.0f,
                53.0f,
                LightShadows.Soft);
            heroRim.transform.LookAt(hero.position + Vector3.up * 1.65f);

            var zombieRim = CreateLight(
                "Zombie rim — ember threat",
                LightType.Spot,
                parent,
                new Vector3(-4.0f, 5.6f, 12.0f),
                Quaternion.identity,
                Html("#FF7B36"),
                860.0f,
                17.0f,
                48.0f,
                LightShadows.None);
            zombieRim.transform.LookAt(zombie.position + Vector3.up * 1.35f);

            var shoulderFill = CreateLight(
                "Shoulder fill — readable hero and threat",
                LightType.Spot,
                parent,
                new Vector3(-3.8f, 6.5f, -6.5f),
                Quaternion.identity,
                Html("#FFD2A3"),
                820.0f,
                32.0f,
                72.0f,
                LightShadows.None);
            shoulderFill.transform.LookAt(
                Vector3.Lerp(hero.position, zombie.position, 0.42f) +
                Vector3.up * 1.35f);

            CreateLight(
                "Left brazier bounce",
                LightType.Point,
                parent,
                new Vector3(-6.1f, 1.5f, 8.3f),
                Quaternion.identity,
                Html("#FF8B43"),
                430.0f,
                7.0f,
                0.0f,
                LightShadows.None);
            CreateLight(
                "Right brazier bounce",
                LightType.Point,
                parent,
                new Vector3(6.2f, 1.5f, 9.8f),
                Quaternion.identity,
                Html("#FF7437"),
                380.0f,
                6.5f,
                0.0f,
                LightShadows.None);
        }

        private static Light CreateLight(
            string name,
            LightType type,
            Transform parent,
            Vector3 position,
            Quaternion rotation,
            Color color,
            float intensity,
            float range,
            float spotAngle,
            LightShadows shadows)
        {
            var gameObject = new GameObject(name);
            gameObject.transform.SetParent(parent, false);
            gameObject.transform.position = position;
            gameObject.transform.rotation = rotation;
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

        private static void BuildCinematicVolume(Transform parent)
        {
            var profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(
                VolumeProfilePath);
            if (profile == null)
            {
                profile = ScriptableObject.CreateInstance<VolumeProfile>();
                profile.name = "P00_CinematicVolume";
                AssetDatabase.CreateAsset(profile, VolumeProfilePath);
            }

            var tonemapping = GetOrAdd<Tonemapping>(profile);
            tonemapping.mode.Override(TonemappingMode.ACES);

            var color = GetOrAdd<ColorAdjustments>(profile);
            color.postExposure.Override(0.15f);
            color.contrast.Override(17.0f);
            color.saturation.Override(-5.0f);
            color.hueShift.Override(-2.0f);
            color.colorFilter.Override(Html("#F4F0E5"));

            var whiteBalance = GetOrAdd<WhiteBalance>(profile);
            whiteBalance.temperature.Override(-3.0f);
            whiteBalance.tint.Override(2.0f);

            var bloom = GetOrAdd<Bloom>(profile);
            bloom.threshold.Override(0.88f);
            bloom.intensity.Override(0.34f);
            bloom.scatter.Override(0.62f);
            bloom.clamp.Override(5.0f);

            var vignette = GetOrAdd<Vignette>(profile);
            vignette.color.Override(Html("#071119"));
            vignette.intensity.Override(0.22f);
            vignette.smoothness.Override(0.47f);
            vignette.rounded.Override(false);

            EditorUtility.SetDirty(profile);
            var volumeObject = new GameObject("Global volume — restrained ACES grade");
            volumeObject.transform.SetParent(parent, false);
            var volume = volumeObject.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.priority = 20.0f;
            volume.sharedProfile = profile;
        }

        private static T GetOrAdd<T>(VolumeProfile profile)
            where T : VolumeComponent
        {
            T component;
            if (!profile.TryGet(out component))
            {
                component = profile.Add<T>(true);
            }

            component.active = true;
            return component;
        }

        private static Camera BuildCamera(Transform hero, Transform zombie)
        {
            var cameraObject = new GameObject("REVIEW CAMERA — S01 Explore");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.position = new Vector3(-5.25f, 3.02f, -13.8f);
            cameraObject.transform.LookAt(new Vector3(4.0f, 1.58f, 8.2f));

            var camera = cameraObject.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.Skybox;
            camera.fieldOfView = 50.0f;
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 105.0f;
            camera.allowHDR = true;
            camera.allowMSAA = true;
            camera.depth = 0.0f;
            camera.useOcclusionCulling = false;

            var data = camera.GetUniversalAdditionalCameraData();
            data.renderPostProcessing = true;
            data.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            data.antialiasingQuality = AntialiasingQuality.High;
            data.dithering = true;

            var listener = cameraObject.AddComponent<AudioListener>();
            listener.enabled = true;

            var focus = new GameObject(
                "Composition target — hero shoulder to arena threat line");
            focus.transform.position =
                Vector3.Lerp(hero.position, zombie.position, 0.58f) +
                Vector3.up * 1.55f;
            return camera;
        }

        private static void BuildAtmosphere(
            Transform parent,
            SceneMaterials materials,
            Random random)
        {
            var atmosphereObject = new GameObject(
                "Atmosphere — fixed-seed drifting embers");
            atmosphereObject.transform.SetParent(parent, false);
            atmosphereObject.transform.position = new Vector3(0.0f, 2.5f, 9.0f);

            var particles = atmosphereObject.AddComponent<ParticleSystem>();
            particles.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            particles.useAutoRandomSeed = false;
            particles.randomSeed = unchecked((uint)P00CaptureContract.Seed);

            var main = particles.main;
            main.loop = true;
            main.duration = 12.0f;
            main.startLifetime = new ParticleSystem.MinMaxCurve(8.0f, 14.0f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.015f, 0.055f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.025f, 0.075f);
            main.startColor = new ParticleSystem.MinMaxGradient(
                new Color(1.0f, 0.57f, 0.27f, 0.16f),
                new Color(0.67f, 0.85f, 0.86f, 0.07f));
            main.maxParticles = 110;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = -0.012f;

            var emission = particles.emission;
            emission.rateOverTime = 8.0f;

            var shape = particles.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(24.0f, 5.0f, 30.0f);

            var renderer = atmosphereObject.GetComponent<ParticleSystemRenderer>();
            renderer.renderMode = ParticleSystemRenderMode.Billboard;
            renderer.material = materials.Dust;
            renderer.sortingFudge = -0.5f;

            particles.Simulate(
                7.25f + NextRange(random, 0.0f, 0.01f),
                true,
                true,
                true);
            particles.Pause(true);
        }

        private static GameObject CreatePrimitive(
            string name,
            PrimitiveType primitiveType,
            Transform parent,
            Vector3 worldPosition,
            Vector3 localScale,
            Material material,
            Quaternion? worldRotation = null)
        {
            var gameObject = GameObject.CreatePrimitive(primitiveType);
            gameObject.name = name;
            gameObject.transform.SetParent(parent, true);
            gameObject.transform.position = worldPosition;
            gameObject.transform.rotation = worldRotation ?? Quaternion.identity;
            gameObject.transform.localScale = localScale;

            var collider = gameObject.GetComponent<Collider>();
            if (collider != null)
            {
                Object.DestroyImmediate(collider);
            }

            var renderer = gameObject.GetComponent<Renderer>();
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = ShadowCastingMode.On;
            renderer.receiveShadows = true;
            renderer.lightProbeUsage = LightProbeUsage.Off;
            renderer.reflectionProbeUsage = ReflectionProbeUsage.Off;
            return gameObject;
        }

        private static void FaceToward(Transform transform, Vector3 target)
        {
            var direction = target - transform.position;
            direction.y = 0.0f;
            if (direction.sqrMagnitude > 0.001f)
            {
                transform.rotation = Quaternion.LookRotation(direction.normalized);
            }
        }

        private static void MakeStatic(GameObject gameObject)
        {
            GameObjectUtility.SetStaticEditorFlags(
                gameObject,
                StaticEditorFlags.BatchingStatic |
                StaticEditorFlags.OccludeeStatic |
                StaticEditorFlags.ReflectionProbeStatic);
        }

        private static void EnsureFolder(string parent, string folderName)
        {
            var path = parent + "/" + folderName;
            if (!AssetDatabase.IsValidFolder(path))
            {
                AssetDatabase.CreateFolder(parent, folderName);
            }
        }

        private static void SetColor(Material material, string property, Color value)
        {
            if (material.HasProperty(property))
            {
                material.SetColor(property, value);
            }
        }

        private static void SetFloat(Material material, string property, float value)
        {
            if (material.HasProperty(property))
            {
                material.SetFloat(property, value);
            }
        }

        private static float NextRange(Random random, float minimum, float maximum)
        {
            return minimum + (float)random.NextDouble() * (maximum - minimum);
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

        private sealed class SceneMaterials
        {
            public Material Skybox;
            public Material Stone;
            public Material WetStone;
            public Material Sandstone;
            public Material Moss;
            public Material HeroCloth;
            public Material HeroArmor;
            public Material Bronze;
            public Material HeroSkin;
            public Material Hair;
            public Material Linen;
            public Material ZombieSkin;
            public Material ZombieCloth;
            public Material Ember;
            public Material CyanGlow;
            public Material Dust;
        }
    }
}
