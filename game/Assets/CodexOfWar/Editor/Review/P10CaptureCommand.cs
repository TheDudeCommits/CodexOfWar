using System;
using System.Collections.Generic;
using System.Diagnostics;
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
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;

namespace CodexOfWar.Editor.Review
{
    public static class P10CaptureCommand
    {
        private const string LogPrefix = "[P10 Capture] ";

        private static readonly TurntableView[] TurntableViews =
        {
            new TurntableView(
                "Front",
                P10CaptureContract.TurntableFrontRelativePath,
                new Vector3(0.0f, 1.95f, 8.2f)),
            new TurntableView(
                "Three-quarter",
                P10CaptureContract.TurntableThreeQuarterRelativePath,
                new Vector3(-5.7983f, 2.05f, 5.7983f)),
            new TurntableView(
                "Back",
                P10CaptureContract.TurntableBackRelativePath,
                new Vector3(0.0f, 1.95f, -8.2f)),
            new TurntableView(
                "Profile",
                P10CaptureContract.TurntableProfileRelativePath,
                new Vector3(8.2f, 1.95f, 0.0f))
        };

        [MenuItem("Codex of War/Review/Capture P10 Round 001")]
        public static void CaptureRound001FromCommandLine()
        {
            RunCommand(
                () =>
                {
                    var gitState = ReadGitState(GetRepositoryRoot());
                    var build = P10HeroSceneBuilder.BuildAndSave();
                    QualitySettings.vSyncCount = 0;
                    UnityEngine.Random.InitState(P10CaptureContract.Seed);

                    var reviewScene = EditorSceneManager.OpenScene(
                        P10CaptureContract.SceneAssetPath,
                        OpenSceneMode.Single);
                    var reviewCamera = FindCamera(reviewScene, "REVIEW CAMERA");
                    var hero = FindHero(reviewScene);
                    P10HeroSceneBuilder.ValidateLockedCamera(reviewCamera);
                    var screenshotBytes = RenderCamera(
                        reviewCamera,
                        P10CaptureContract.Width,
                        P10CaptureContract.Height,
                        "P10_S01_Explore_1600x900");
                    WritePublicBytes(
                        P10CaptureContract.CaptureRelativePath,
                        screenshotBytes);

                    var heroTelemetry = ReadHeroTelemetry(hero, reviewCamera);
                    var turntableScene = EditorSceneManager.OpenScene(
                        P10CaptureContract.TurntableSceneAssetPath,
                        OpenSceneMode.Single);
                    var turntableCamera = FindCamera(
                        turntableScene,
                        "P10 TURNTABLE CAMERA");
                    var turntableImages = CaptureTurntable(turntableCamera);
                    var contactSheetBytes = BuildContactSheet(turntableImages);
                    WritePublicBytes(
                        P10CaptureContract.TurntableContactSheetRelativePath,
                        contactSheetBytes);

                    var manifest = BuildManifest(
                        screenshotBytes,
                        contactSheetBytes,
                        turntableImages,
                        heroTelemetry,
                        gitState,
                        build);
                    WriteManifest(manifest);

                    var errors = ValidateCaptureBundle();
                    if (errors.Count > 0)
                    {
                        throw new InvalidOperationException(
                            "P10 capture validation failed:\n- " +
                            string.Join("\n- ", errors));
                    }

                    Debug.Log(
                        LogPrefix +
                        "PASS " +
                        manifest.screenshotRelativePath +
                        " sha256=" +
                        manifest.screenshotSha256 +
                        " heroScreenHeight=" +
                        manifest.heroScreenHeightFraction.ToString(
                            "P2",
                            CultureInfo.InvariantCulture) +
                        " triangles=" +
                        manifest.heroTriangleCount);
                });
        }

        [MenuItem("Codex of War/Review/Validate P10 Round 001")]
        public static void ValidateFromCommandLine()
        {
            RunCommand(
                () =>
                {
                    var errors = ValidateCaptureBundle();
                    if (errors.Count > 0)
                    {
                        throw new InvalidOperationException(
                            "P10 standalone validation failed:\n- " +
                            string.Join("\n- ", errors));
                    }

                    Debug.Log(LogPrefix + "standalone validation PASS");
                });
        }

        public static List<string> ValidateCaptureBundle()
        {
            var errors = new List<string>();
            var publicRoot = GetProgressPublicRoot();
            var manifestPath = ResolveUnderPublicRoot(
                publicRoot,
                P10CaptureContract.RoundManifestRelativePath);
            var screenshotPath = ResolveUnderPublicRoot(
                publicRoot,
                P10CaptureContract.CaptureRelativePath);
            if (!File.Exists(manifestPath))
            {
                errors.Add("P10 round manifest is missing: " + manifestPath);
                return errors;
            }

            if (!File.Exists(screenshotPath))
            {
                errors.Add("P10 S01 screenshot is missing: " + screenshotPath);
                return errors;
            }

            P10CaptureManifest manifest;
            try
            {
                manifest = JsonUtility.FromJson<P10CaptureManifest>(
                    File.ReadAllText(manifestPath, Encoding.UTF8));
            }
            catch (Exception exception)
            {
                errors.Add("P10 manifest could not be parsed: " + exception.Message);
                return errors;
            }

            var turntableBytes = new Dictionary<string, byte[]>(
                StringComparer.Ordinal);
            foreach (var relativePath in AllTurntablePaths())
            {
                var absolute = ResolveUnderPublicRoot(publicRoot, relativePath);
                if (File.Exists(absolute))
                {
                    turntableBytes[relativePath] = File.ReadAllBytes(absolute);
                }
            }

            var sourceBytes = ReadSourceAssetBytes(errors);
            var screenshotBytes = File.ReadAllBytes(screenshotPath);
            errors.AddRange(
                P10ManifestValidator.Validate(
                    manifest,
                    screenshotBytes,
                    turntableBytes,
                    sourceBytes));
            ValidateImage(screenshotBytes, "S01 screenshot", errors);
            foreach (var pair in turntableBytes)
            {
                ValidateImage(pair.Value, pair.Key, errors);
            }

            ValidateCurrentProjectState(manifest, errors);
            return errors;
        }

        private static Dictionary<string, byte[]> CaptureTurntable(Camera camera)
        {
            var result = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            foreach (var view in TurntableViews)
            {
                camera.transform.position = view.Position;
                camera.transform.LookAt(
                    new Vector3(
                        P10CaptureContract.TurntableTargetX,
                        P10CaptureContract.TurntableTargetY,
                        P10CaptureContract.TurntableTargetZ));
                camera.fieldOfView = P10CaptureContract.TurntableFieldOfView;
                ValidateTurntableFraming(camera, view.Label);
                var bytes = RenderCamera(
                    camera,
                    P10CaptureContract.Width,
                    P10CaptureContract.Height,
                    "P10_Turntable_" + view.Label);
                WritePublicBytes(view.RelativePath, bytes);
                result.Add(view.RelativePath, bytes);
            }

            return result;
        }

        private static void ValidateTurntableFraming(
            Camera camera,
            string label)
        {
            var marker = camera.gameObject.scene.GetRootGameObjects()
                .SelectMany(root => root.GetComponentsInChildren<P10HeroMarker>(true))
                .SingleOrDefault();
            if (marker == null)
            {
                throw new InvalidOperationException(
                    "Turntable scene is missing the P10 hero marker.");
            }

            var renderers = marker.GetComponentsInChildren<Renderer>(true)
                .Where(
                    renderer =>
                        renderer.shadowCastingMode !=
                        ShadowCastingMode.ShadowsOnly)
                .ToArray();
            var minimumX = float.PositiveInfinity;
            var minimumY = float.PositiveInfinity;
            var maximumX = float.NegativeInfinity;
            var maximumY = float.NegativeInfinity;
            foreach (var renderer in renderers)
            {
                var bounds = renderer.bounds;
                for (var x = -1; x <= 1; x += 2)
                {
                    for (var y = -1; y <= 1; y += 2)
                    {
                        for (var z = -1; z <= 1; z += 2)
                        {
                            var world = bounds.center + Vector3.Scale(
                                bounds.extents,
                                new Vector3(x, y, z));
                            var viewport = camera.WorldToViewportPoint(world);
                            if (viewport.z <= 0.0f)
                            {
                                throw new InvalidOperationException(
                                    label +
                                    " turntable hero bounds cross behind camera.");
                            }

                            minimumX = Mathf.Min(minimumX, viewport.x);
                            minimumY = Mathf.Min(minimumY, viewport.y);
                            maximumX = Mathf.Max(maximumX, viewport.x);
                            maximumY = Mathf.Max(maximumY, viewport.y);
                        }
                    }
                }
            }

            const float margin = 0.04f;
            if (minimumX < margin ||
                minimumY < margin ||
                maximumX > 1.0f - margin ||
                maximumY > 1.0f - margin)
            {
                throw new InvalidOperationException(
                    string.Format(
                        CultureInfo.InvariantCulture,
                        "{0} turntable framing clips authored hero bounds: " +
                        "x={1:F3}..{2:F3}, y={3:F3}..{4:F3}.",
                        label,
                        minimumX,
                        maximumX,
                        minimumY,
                        maximumY));
            }
        }

        private static byte[] BuildContactSheet(
            IReadOnlyDictionary<string, byte[]> images)
        {
            var output = new Texture2D(
                P10CaptureContract.Width,
                P10CaptureContract.Height,
                TextureFormat.RGBA32,
                false,
                false);
            var destination = new Color32[
                P10CaptureContract.Width * P10CaptureContract.Height];
            var background = new Color32(14, 22, 28, 255);
            for (var index = 0; index < destination.Length; index++)
            {
                destination[index] = background;
            }

            for (var viewIndex = 0; viewIndex < TurntableViews.Length; viewIndex++)
            {
                var view = TurntableViews[viewIndex];
                var source = new Texture2D(2, 2, TextureFormat.RGBA32, false, false);
                try
                {
                    if (!source.LoadImage(images[view.RelativePath], false))
                    {
                        throw new InvalidOperationException(
                            "Could not decode turntable view " + view.Label);
                    }

                    var sourcePixels = source.GetPixels32();
                    var quadrantX = viewIndex % 2;
                    var quadrantY = viewIndex < 2 ? 1 : 0;
                    for (var y = 0; y < P10CaptureContract.Height / 2; y++)
                    {
                        for (var x = 0; x < P10CaptureContract.Width / 2; x++)
                        {
                            var sourceX = x * 2;
                            var sourceY = y * 2;
                            var a = sourcePixels[
                                sourceY * P10CaptureContract.Width + sourceX];
                            var b = sourcePixels[
                                sourceY * P10CaptureContract.Width + sourceX + 1];
                            var c = sourcePixels[
                                (sourceY + 1) * P10CaptureContract.Width + sourceX];
                            var d = sourcePixels[
                                (sourceY + 1) * P10CaptureContract.Width +
                                sourceX +
                                1];
                            var averaged = new Color32(
                                (byte)((a.r + b.r + c.r + d.r) / 4),
                                (byte)((a.g + b.g + c.g + d.g) / 4),
                                (byte)((a.b + b.b + c.b + d.b) / 4),
                                255);
                            var destinationX =
                                quadrantX * (P10CaptureContract.Width / 2) + x;
                            var destinationY =
                                quadrantY * (P10CaptureContract.Height / 2) + y;
                            destination[
                                destinationY * P10CaptureContract.Width +
                                destinationX] = averaged;
                        }
                    }
                }
                finally
                {
                    Object.DestroyImmediate(source);
                }
            }

            var divider = new Color32(59, 222, 226, 255);
            for (var offset = -2; offset <= 2; offset++)
            {
                var verticalX = P10CaptureContract.Width / 2 + offset;
                for (var y = 0; y < P10CaptureContract.Height; y++)
                {
                    destination[y * P10CaptureContract.Width + verticalX] =
                        divider;
                }

                var horizontalY = P10CaptureContract.Height / 2 + offset;
                for (var x = 0; x < P10CaptureContract.Width; x++)
                {
                    destination[
                        horizontalY * P10CaptureContract.Width + x] = divider;
                }
            }

            output.SetPixels32(destination);
            output.Apply(false, false);
            try
            {
                return output.EncodeToPNG();
            }
            finally
            {
                Object.DestroyImmediate(output);
            }
        }

        private static byte[] RenderCamera(
            Camera camera,
            int width,
            int height,
            string renderTextureName)
        {
            var renderTexture = new RenderTexture(
                width,
                height,
                24,
                RenderTextureFormat.ARGB32,
                RenderTextureReadWrite.sRGB)
            {
                name = renderTextureName,
                antiAliasing = 1,
                useMipMap = false,
                autoGenerateMips = false,
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };
            renderTexture.Create();
            var previousActive = RenderTexture.active;
            var previousTarget = camera.targetTexture;
            Texture2D texture = null;
            try
            {
                camera.aspect = width / (float)height;
                camera.targetTexture = renderTexture;
                RenderTexture.active = renderTexture;
                GL.Clear(true, true, Color.black);
                var cameraData = camera.GetUniversalAdditionalCameraData();
                VolumeManager.instance.Update(
                    camera.transform,
                    cameraData.volumeLayerMask);
                camera.Render();
                GL.Clear(true, true, Color.black);
                camera.Render();
                texture = new Texture2D(
                    width,
                    height,
                    TextureFormat.RGBA32,
                    false,
                    false);
                texture.ReadPixels(new Rect(0, 0, width, height), 0, 0, false);
                texture.Apply(false, false);
                var bytes = texture.EncodeToPNG();
                if (bytes == null || bytes.Length == 0)
                {
                    throw new InvalidOperationException(
                        "Unity returned an empty PNG for " + renderTextureName);
                }

                return bytes;
            }
            finally
            {
                camera.targetTexture = previousTarget;
                RenderTexture.active = previousActive;
                if (texture != null)
                {
                    Object.DestroyImmediate(texture);
                }

                renderTexture.Release();
                Object.DestroyImmediate(renderTexture);
            }
        }

        private static P10CaptureManifest BuildManifest(
            byte[] screenshotBytes,
            byte[] contactSheetBytes,
            IReadOnlyDictionary<string, byte[]> turntableBytes,
            HeroTelemetry hero,
            GitState gitState,
            P10HeroSceneBuilder.BuildResult build)
        {
            var pipeline = GraphicsSettings.currentRenderPipeline;
            if (pipeline == null)
            {
                pipeline = QualitySettings.renderPipeline;
            }

            if (pipeline == null)
            {
                throw new InvalidOperationException(
                    "No active Scriptable Render Pipeline is configured.");
            }

            var pipelinePath = AssetDatabase.GetAssetPath(pipeline);
            var urpPackage = UnityEditor.PackageManager.PackageInfo.FindForAssembly(
                typeof(UniversalRenderPipelineAsset).Assembly);
            var urpVersion = urpPackage != null ? urpPackage.version : "unknown";
            var sourceAssets = BuildSourceAssetEvidence();
            var turntableEvidence = new List<P10ImageEvidence>();
            foreach (var view in TurntableViews)
            {
                var bytes = turntableBytes[view.RelativePath];
                turntableEvidence.Add(
                    new P10ImageEvidence
                    {
                        label = view.Label,
                        relativePath = view.RelativePath,
                        sha256 = P00CaptureContract.Sha256(bytes),
                        width = P10CaptureContract.Width,
                        height = P10CaptureContract.Height,
                        cameraPositionX = view.Position.x,
                        cameraPositionY = view.Position.y,
                        cameraPositionZ = view.Position.z,
                        targetX = P10CaptureContract.TurntableTargetX,
                        targetY = P10CaptureContract.TurntableTargetY,
                        targetZ = P10CaptureContract.TurntableTargetZ,
                        fieldOfView =
                            P10CaptureContract.TurntableFieldOfView
                    });
            }

            turntableEvidence.Add(
                new P10ImageEvidence
                {
                    label = "Four-view contact sheet",
                    relativePath =
                        P10CaptureContract.TurntableContactSheetRelativePath,
                    sha256 = P00CaptureContract.Sha256(contactSheetBytes),
                    width = P10CaptureContract.Width,
                    height = P10CaptureContract.Height
                });

            var reviewScene = EditorSceneManager.OpenScene(
                P10CaptureContract.SceneAssetPath,
                OpenSceneMode.Single);
            var camera = FindCamera(reviewScene, "REVIEW CAMERA");
            var cameraData = camera.GetUniversalAdditionalCameraData();
            return new P10CaptureManifest
            {
                schemaVersion = P10CaptureContract.SchemaVersion,
                piece = P10CaptureContract.Piece,
                round = P10CaptureContract.Round,
                gitRevision = gitState.Revision,
                workingTree = gitState.IsDirty,
                gitState = gitState.IsDirty ? "working-tree" : "clean",
                unityVersion = Application.unityVersion,
                urpVersion = urpVersion,
                renderPipelineAsset = pipelinePath,
                renderSettingsSha256 = ComputeRenderSettingsHash(
                    pipelinePath,
                    urpVersion),
                p00BaselineScreenshotSha256 =
                    P10CaptureContract.ExpectedP00ScreenshotSha256,
                p00BaselineRenderSettingsSha256 =
                    P10CaptureContract.ExpectedRenderSettingsSha256,
                p00SceneSha256Before = build.P00SceneSha256Before,
                p00SceneSha256After = build.P00SceneSha256After,
                frozenEnvironmentSha256P00 =
                    build.FrozenEnvironmentSha256P00,
                frozenEnvironmentSha256P10 =
                    build.FrozenEnvironmentSha256P10,
                baselineProfilePersistenceNote =
                    P10CaptureContract.BaselineProfilePersistenceNote,
                scene = P10CaptureContract.SceneAssetPath,
                seed = P10CaptureContract.Seed,
                preset = P10CaptureContract.Preset,
                resolution = new CaptureResolution
                {
                    width = P10CaptureContract.Width,
                    height = P10CaptureContract.Height
                },
                camera = new P10CameraProfile
                {
                    positionX = camera.transform.position.x,
                    positionY = camera.transform.position.y,
                    positionZ = camera.transform.position.z,
                    rotationX = camera.transform.rotation.x,
                    rotationY = camera.transform.rotation.y,
                    rotationZ = camera.transform.rotation.z,
                    rotationW = camera.transform.rotation.w,
                    fieldOfView = camera.fieldOfView,
                    nearClip = camera.nearClipPlane,
                    farClip = camera.farClipPlane,
                    hdr = camera.allowHDR,
                    msaa = camera.allowMSAA,
                    postProcessing = cameraData.renderPostProcessing,
                    antialiasing = cameraData.antialiasing.ToString(),
                    antialiasingQuality =
                        cameraData.antialiasingQuality.ToString(),
                    dithering = cameraData.dithering,
                    occlusionCulling = camera.useOcclusionCulling
                },
                capturedAtUtc = DateTime.UtcNow.ToString(
                    "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
                    CultureInfo.InvariantCulture),
                machineProfile = new CaptureMachineProfile
                {
                    operatingSystem = SystemInfo.operatingSystem,
                    deviceModel = SystemInfo.deviceModel,
                    processor = SystemInfo.processorType,
                    systemMemoryMb = SystemInfo.systemMemorySize,
                    graphicsDevice = SystemInfo.graphicsDeviceName,
                    graphicsApi = SystemInfo.graphicsDeviceType.ToString()
                },
                screenshotRelativePath = P10CaptureContract.CaptureRelativePath,
                screenshotSha256 = P00CaptureContract.Sha256(screenshotBytes),
                captureContractSha256 = P10CaptureContract.BuildContractHash(),
                heroAssetPath = P10CaptureContract.HeroModelAssetPath,
                heroAssetGuid = AssetDatabase.AssetPathToGUID(
                    P10CaptureContract.HeroModelAssetPath),
                heroMeshCount = hero.MeshCount,
                heroRendererCount = hero.RendererCount,
                heroTriangleCount = hero.TriangleCount,
                heroMaterialCount = hero.MaterialNames.Length,
                heroScreenHeightFraction = hero.ScreenHeightFraction,
                heroMaterialNames = hero.MaterialNames,
                proxyLeakageDetected = false,
                sourceAssets = sourceAssets,
                turntableImages = turntableEvidence.ToArray()
            };
        }

        private static P10AssetEvidence[] BuildSourceAssetEvidence()
        {
            var repositoryRoot = GetRepositoryRoot();
            return new[]
            {
                SourceRecord(
                    repositoryRoot,
                    P10CaptureContract.HeroBlenderScriptRepositoryPath,
                    string.Empty,
                    "Original deterministic Blender 5.2 Python authorship",
                    "Original project work; repository redistribution permitted",
                    "Creates all 120 modular meshes, material slots, silhouette details, editable blend, and FBX."),
                SourceRecord(
                    repositoryRoot,
                    P10CaptureContract.HeroBlenderSourceRepositoryPath,
                    string.Empty,
                    "Generated editable source from the checked-in P10 Blender script",
                    "Original project work; repository redistribution permitted",
                    "Editable Blender 5.2 source with named modular meshes and materials."),
                SourceRecord(
                    repositoryRoot,
                    "game/" + P10CaptureContract.HeroModelAssetPath,
                    P10CaptureContract.HeroModelAssetPath,
                    "Deterministic FBX export from original checked-in Blender source",
                    "Original project work; repository redistribution permitted",
                    "Unity delivery mesh; meter units, authored normals, no animation or external dependencies."),
                TextureSourceRecord(repositoryRoot, "P10_ClothLeather_Atlas.png"),
                TextureSourceRecord(repositoryRoot, "P10_Glow_Atlas.png"),
                TextureSourceRecord(repositoryRoot, "P10_Hair_Atlas.png"),
                TextureSourceRecord(repositoryRoot, "P10_Metal_Atlas.png"),
                TextureSourceRecord(repositoryRoot, "P10_Skin_Atlas.png")
            };
        }

        private static P10AssetEvidence TextureSourceRecord(
            string repositoryRoot,
            string fileName)
        {
            const string unityRoot =
                "Assets/CodexOfWar/Heroes/P10/Textures/";
            var unityPath = unityRoot + fileName;
            return SourceRecord(
                repositoryRoot,
                "game/" + unityPath,
                unityPath,
                "Original procedural atlas generated by the checked-in Blender script",
                "Original project work; repository redistribution permitted",
                "Deterministic palette atlas supplying authored color-family breakup.");
        }

        private static P10AssetEvidence SourceRecord(
            string repositoryRoot,
            string repositoryPath,
            string unityPath,
            string origin,
            string license,
            string modificationRecord)
        {
            var absolute = ResolveRepositoryPath(repositoryRoot, repositoryPath);
            if (!File.Exists(absolute))
            {
                throw new FileNotFoundException(
                    "P10 source asset is missing.",
                    absolute);
            }

            return new P10AssetEvidence
            {
                repositoryPath = repositoryPath,
                unityAssetPath = unityPath,
                sha256 = P00CaptureContract.Sha256(File.ReadAllBytes(absolute)),
                origin = origin,
                license = license,
                modificationRecord = modificationRecord
            };
        }

        public static string ComputeRenderSettingsHash(
            string pipelineAssetPath,
            string urpVersion)
        {
            var settingsPaths = new SortedSet<string>(StringComparer.Ordinal);
            foreach (var dependency in AssetDatabase.GetDependencies(
                         pipelineAssetPath,
                         true))
            {
                if (dependency.StartsWith(
                        "Assets/Settings/",
                        StringComparison.Ordinal) &&
                    dependency.EndsWith(
                        ".asset",
                        StringComparison.OrdinalIgnoreCase))
                {
                    settingsPaths.Add(dependency);
                }
            }

            settingsPaths.Add(pipelineAssetPath);
            settingsPaths.Add(
                "Assets/CodexOfWar/Review/Profiles/P00_CinematicVolume.asset");
            settingsPaths.Add("ProjectSettings/GraphicsSettings.asset");
            settingsPaths.Add("ProjectSettings/QualitySettings.asset");
            settingsPaths.Add("ProjectSettings/URPProjectSettings.asset");

            var projectRoot = Path.GetFullPath(
                Path.Combine(Application.dataPath, ".."));
            var canonical = new StringBuilder();
            canonical.Append("urp=").Append(urpVersion).Append('\n');
            foreach (var path in settingsPaths)
            {
                var absolute = Path.GetFullPath(
                    Path.Combine(
                        projectRoot,
                        path.Replace('/', Path.DirectorySeparatorChar)));
                if (!File.Exists(absolute))
                {
                    throw new FileNotFoundException(
                        "A render-settings input is missing.",
                        absolute);
                }

                canonical
                    .Append(path)
                    .Append('=')
                    .Append(P00CaptureContract.Sha256(File.ReadAllBytes(absolute)))
                    .Append('\n');
            }

            canonical
                .Append("colorSpace=").Append(PlayerSettings.colorSpace).Append('\n')
                .Append("quality=")
                .Append(QualitySettings.names[QualitySettings.GetQualityLevel()])
                .Append('\n');
            return P00CaptureContract.Sha256(
                Encoding.UTF8.GetBytes(canonical.ToString()));
        }

        private static void ValidateCurrentProjectState(
            P10CaptureManifest manifest,
            ICollection<string> errors)
        {
            var repositoryRoot = GetRepositoryRoot();
            var p00Screenshot = ResolveUnderPublicRoot(
                GetProgressPublicRoot(),
                P00CaptureContract.CaptureRelativePath);
            if (!File.Exists(p00Screenshot) ||
                !string.Equals(
                    P00CaptureContract.Sha256(File.ReadAllBytes(p00Screenshot)),
                    P10CaptureContract.ExpectedP00ScreenshotSha256,
                    StringComparison.Ordinal))
            {
                errors.Add("The filed P00 baseline screenshot hash drifted.");
            }

            var p00SceneAbsolute = ResolveRepositoryPath(
                repositoryRoot,
                "game/" + P00CaptureContract.SceneAssetPath);
            if (!File.Exists(p00SceneAbsolute))
            {
                errors.Add("The P00 baseline scene is missing.");
                return;
            }

            var currentP00SceneHash = P00CaptureContract.Sha256(
                File.ReadAllBytes(p00SceneAbsolute));
            if (!string.Equals(
                    currentP00SceneHash,
                    manifest.p00SceneSha256Before,
                    StringComparison.Ordinal))
            {
                errors.Add("The current P00 scene hash differs from the P10 manifest.");
            }

            var pipeline = GraphicsSettings.currentRenderPipeline;
            if (pipeline == null)
            {
                pipeline = QualitySettings.renderPipeline;
            }

            var urpPackage = UnityEditor.PackageManager.PackageInfo.FindForAssembly(
                typeof(UniversalRenderPipelineAsset).Assembly);
            var currentRenderHash = ComputeRenderSettingsHash(
                AssetDatabase.GetAssetPath(pipeline),
                urpPackage != null ? urpPackage.version : "unknown");
            if (!string.Equals(
                    currentRenderHash,
                    P10CaptureContract.ExpectedRenderSettingsSha256,
                    StringComparison.Ordinal))
            {
                errors.Add(
                    "Render settings drifted from the accepted P00 hash: " +
                    currentRenderHash);
            }

            var p00Scene = EditorSceneManager.OpenScene(
                P00CaptureContract.SceneAssetPath,
                OpenSceneMode.Single);
            var p00Environment = P10HeroSceneBuilder.ComputeFrozenEnvironmentHash(
                p00Scene);
            var p10Scene = EditorSceneManager.OpenScene(
                P10CaptureContract.SceneAssetPath,
                OpenSceneMode.Single);
            var p10Environment = P10HeroSceneBuilder.ComputeFrozenEnvironmentHash(
                p10Scene);
            if (!string.Equals(
                    p00Environment,
                    p10Environment,
                    StringComparison.Ordinal))
            {
                errors.Add("P10 arena/environment/camera signature drifted.");
            }

            var camera = FindCamera(p10Scene, "REVIEW CAMERA");
            try
            {
                P10HeroSceneBuilder.ValidateLockedCamera(camera);
            }
            catch (Exception exception)
            {
                errors.Add(exception.Message);
            }

            var heroes = p10Scene.GetRootGameObjects()
                .SelectMany(root => root.GetComponentsInChildren<P10HeroMarker>(true))
                .ToArray();
            if (heroes.Length != 1)
            {
                errors.Add(
                    "P10 scene must contain exactly one authored P10HeroMarker.");
                return;
            }

            var marker = heroes[0];
            if (!string.Equals(
                    marker.HeroId,
                    "P10_ASTRA_VALE_ORIGINAL",
                    StringComparison.Ordinal) ||
                !string.Equals(
                    marker.SourceAssetPath,
                    P10CaptureContract.HeroModelAssetPath,
                    StringComparison.Ordinal) ||
                marker.SourceSeed != P10CaptureContract.Seed)
            {
                errors.Add("P10 hero marker references the wrong authored asset.");
            }

            foreach (var root in p10Scene.GetRootGameObjects())
            {
                foreach (var transform in root.GetComponentsInChildren<Transform>(true))
                {
                    if (transform.gameObject.name.IndexOf(
                            "Sentinel proxy",
                            StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        errors.Add(
                            "P00 proxy leakage found in the P10 scene: " +
                            transform.gameObject.name);
                    }
                }
            }

            var telemetry = ReadHeroTelemetry(marker.gameObject, camera);
            if (telemetry.MeshCount != manifest.heroMeshCount ||
                telemetry.RendererCount != manifest.heroRendererCount ||
                telemetry.TriangleCount != manifest.heroTriangleCount ||
                Mathf.Abs(
                    telemetry.ScreenHeightFraction -
                    manifest.heroScreenHeightFraction) > 0.0001f)
            {
                errors.Add("P10 hero telemetry differs from the manifest.");
            }

            var guid = AssetDatabase.AssetPathToGUID(
                P10CaptureContract.HeroModelAssetPath);
            if (string.IsNullOrWhiteSpace(guid) ||
                !string.Equals(guid, manifest.heroAssetGuid, StringComparison.Ordinal))
            {
                errors.Add("P10 hero FBX GUID is missing or drifted.");
            }
        }

        private static HeroTelemetry ReadHeroTelemetry(
            GameObject hero,
            Camera camera)
        {
            if (hero == null || camera == null)
            {
                throw new ArgumentNullException(
                    hero == null ? nameof(hero) : nameof(camera));
            }

            var renderers = hero.GetComponentsInChildren<Renderer>(true)
                .Where(
                    renderer =>
                        renderer.shadowCastingMode !=
                        ShadowCastingMode.ShadowsOnly &&
                        !renderer.gameObject.name.StartsWith(
                            "P10 CONTACT SHADOW",
                            StringComparison.Ordinal))
                .ToArray();
            var meshFilters = hero.GetComponentsInChildren<MeshFilter>(true)
                .Where(
                    filter =>
                    {
                        var renderer = filter.GetComponent<Renderer>();
                        return renderer == null ||
                               renderer.shadowCastingMode !=
                               ShadowCastingMode.ShadowsOnly &&
                               !renderer.gameObject.name.StartsWith(
                                   "P10 CONTACT SHADOW",
                                   StringComparison.Ordinal);
                    })
                .ToArray();
            var triangleCount = 0;
            foreach (var filter in meshFilters)
            {
                if (filter.sharedMesh != null)
                {
                    triangleCount += filter.sharedMesh.triangles.Length / 3;
                }
            }

            var materialNames = renderers
                .SelectMany(renderer => renderer.sharedMaterials)
                .Where(material => material != null)
                .Select(material => material.name)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToArray();
            var bodyRenderers = renderers.Where(
                    renderer =>
                        renderer.gameObject.name.IndexOf(
                            "Greatblade",
                            StringComparison.OrdinalIgnoreCase) < 0 &&
                        !renderer.gameObject.name.StartsWith(
                            "Weapon_",
                            StringComparison.Ordinal))
                .ToArray();
            var screenHeight = ComputeScreenHeightFraction(bodyRenderers, camera);
            return new HeroTelemetry
            {
                MeshCount = meshFilters.Length,
                RendererCount = renderers.Length,
                TriangleCount = triangleCount,
                MaterialNames = materialNames,
                ScreenHeightFraction = screenHeight
            };
        }

        private static float ComputeScreenHeightFraction(
            IReadOnlyList<Renderer> renderers,
            Camera camera)
        {
            var minimum = float.PositiveInfinity;
            var maximum = float.NegativeInfinity;
            foreach (var renderer in renderers)
            {
                var bounds = renderer.bounds;
                for (var x = -1; x <= 1; x += 2)
                {
                    for (var y = -1; y <= 1; y += 2)
                    {
                        for (var z = -1; z <= 1; z += 2)
                        {
                            var point = bounds.center + Vector3.Scale(
                                bounds.extents,
                                new Vector3(x, y, z));
                            var viewport = camera.WorldToViewportPoint(point);
                            if (viewport.z <= 0.0f)
                            {
                                continue;
                            }

                            minimum = Mathf.Min(minimum, viewport.y);
                            maximum = Mathf.Max(maximum, viewport.y);
                        }
                    }
                }
            }

            if (float.IsInfinity(minimum) || float.IsInfinity(maximum))
            {
                throw new InvalidOperationException(
                    "Hero did not project into the locked S01 camera.");
            }

            return maximum - minimum;
        }

        private static void ValidateImage(
            byte[] bytes,
            string label,
            ICollection<string> errors)
        {
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            try
            {
                if (!texture.LoadImage(bytes, false))
                {
                    errors.Add(label + " could not be decoded by Unity.");
                    return;
                }

                if (texture.width != P10CaptureContract.Width ||
                    texture.height != P10CaptureContract.Height)
                {
                    errors.Add(label + " has the wrong dimensions.");
                    return;
                }

                var pixels = texture.GetPixels32();
                var step = Math.Max(1, pixels.Length / 16000);
                var minimumLuminance = 1.0f;
                var maximumLuminance = 0.0f;
                var sum = 0.0;
                var magenta = 0;
                var sampled = 0;
                for (var index = 0; index < pixels.Length; index += step)
                {
                    var pixel = pixels[index];
                    var red = pixel.r / 255.0f;
                    var green = pixel.g / 255.0f;
                    var blue = pixel.b / 255.0f;
                    var luminance =
                        red * 0.2126f + green * 0.7152f + blue * 0.0722f;
                    minimumLuminance = Mathf.Min(minimumLuminance, luminance);
                    maximumLuminance = Mathf.Max(maximumLuminance, luminance);
                    sum += luminance;
                    sampled++;
                    if (red > 0.82f && blue > 0.82f && green < 0.22f)
                    {
                        magenta++;
                    }
                }

                var mean = sampled > 0 ? sum / sampled : 0.0;
                if (maximumLuminance - minimumLuminance < 0.18f ||
                    mean < 0.025 ||
                    mean > 0.975)
                {
                    errors.Add(label + " appears blank or lacks tonal range.");
                }

                if (sampled > 0 && magenta / (double)sampled > 0.006)
                {
                    errors.Add(label + " has a pink-shader signature.");
                }
            }
            finally
            {
                Object.DestroyImmediate(texture);
            }
        }

        private static Camera FindCamera(Scene scene, string namePrefix)
        {
            foreach (var root in scene.GetRootGameObjects())
            {
                foreach (var camera in root.GetComponentsInChildren<Camera>(true))
                {
                    if (camera.gameObject.name.StartsWith(
                            namePrefix,
                            StringComparison.Ordinal))
                    {
                        return camera;
                    }
                }
            }

            throw new InvalidOperationException(
                "Required camera was not found: " + namePrefix);
        }

        private static GameObject FindHero(Scene scene)
        {
            foreach (var root in scene.GetRootGameObjects())
            {
                var marker = root.GetComponentInChildren<P10HeroMarker>(true);
                if (marker != null)
                {
                    return marker.gameObject;
                }
            }

            throw new InvalidOperationException(
                "P10 scene did not contain the authored hero marker.");
        }

        private static IReadOnlyDictionary<string, byte[]> ReadSourceAssetBytes(
            ICollection<string> errors)
        {
            var root = GetRepositoryRoot();
            var paths = new[]
            {
                P10CaptureContract.HeroBlenderScriptRepositoryPath,
                P10CaptureContract.HeroBlenderSourceRepositoryPath,
                "game/" + P10CaptureContract.HeroModelAssetPath,
                "game/Assets/CodexOfWar/Heroes/P10/Textures/P10_ClothLeather_Atlas.png",
                "game/Assets/CodexOfWar/Heroes/P10/Textures/P10_Glow_Atlas.png",
                "game/Assets/CodexOfWar/Heroes/P10/Textures/P10_Hair_Atlas.png",
                "game/Assets/CodexOfWar/Heroes/P10/Textures/P10_Metal_Atlas.png",
                "game/Assets/CodexOfWar/Heroes/P10/Textures/P10_Skin_Atlas.png"
            };
            var result = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            foreach (var path in paths)
            {
                var absolute = ResolveRepositoryPath(root, path);
                if (!File.Exists(absolute))
                {
                    errors.Add("P10 source asset is missing: " + path);
                    continue;
                }

                result[path] = File.ReadAllBytes(absolute);
            }

            return result;
        }

        private static IEnumerable<string> AllTurntablePaths()
        {
            foreach (var view in TurntableViews)
            {
                yield return view.RelativePath;
            }

            yield return P10CaptureContract.TurntableContactSheetRelativePath;
        }

        private static void WriteManifest(P10CaptureManifest manifest)
        {
            var bytes = new UTF8Encoding(false).GetBytes(
                JsonUtility.ToJson(manifest, true) + "\n");
            WritePublicBytes(P10CaptureContract.RoundManifestRelativePath, bytes);
        }

        private static void WritePublicBytes(string relativePath, byte[] bytes)
        {
            var path = ResolveUnderPublicRoot(
                GetProgressPublicRoot(),
                relativePath);
            var directory = Path.GetDirectoryName(path);
            if (string.IsNullOrWhiteSpace(directory))
            {
                throw new InvalidOperationException(
                    "P10 output path did not contain a directory.");
            }

            Directory.CreateDirectory(directory);
            var temporary = path + ".tmp";
            File.WriteAllBytes(temporary, bytes);
            if (File.Exists(path))
            {
                File.Delete(path);
            }

            File.Move(temporary, path);
        }

        private static string GetRepositoryRoot()
        {
            return Path.GetFullPath(Path.Combine(Application.dataPath, "..", ".."));
        }

        private static string GetProgressPublicRoot()
        {
            var root = Path.Combine(GetRepositoryRoot(), "progress", "public");
            Directory.CreateDirectory(root);
            return Path.GetFullPath(root);
        }

        private static string ResolveRepositoryPath(
            string repositoryRoot,
            string relativePath)
        {
            var path = Path.GetFullPath(
                Path.Combine(
                    repositoryRoot,
                    relativePath.Replace('/', Path.DirectorySeparatorChar)));
            var prefix = repositoryRoot.EndsWith(
                Path.DirectorySeparatorChar.ToString(),
                StringComparison.Ordinal)
                ? repositoryRoot
                : repositoryRoot + Path.DirectorySeparatorChar;
            if (!path.StartsWith(prefix, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "Repository-relative P10 path escaped the repository.");
            }

            return path;
        }

        private static string ResolveUnderPublicRoot(
            string publicRoot,
            string relativePath)
        {
            var path = Path.GetFullPath(
                Path.Combine(
                    publicRoot,
                    relativePath.Replace('/', Path.DirectorySeparatorChar)));
            var prefix = publicRoot.EndsWith(
                Path.DirectorySeparatorChar.ToString(),
                StringComparison.Ordinal)
                ? publicRoot
                : publicRoot + Path.DirectorySeparatorChar;
            if (!path.StartsWith(prefix, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "P10 output escaped progress/public.");
            }

            return path;
        }

        private static GitState ReadGitState(string repositoryRoot)
        {
            var revision = RunGit(repositoryRoot, "rev-parse HEAD");
            if (string.IsNullOrWhiteSpace(revision))
            {
                revision = "working-tree";
            }

            var status = RunGit(
                repositoryRoot,
                "status --porcelain --untracked-files=normal");
            return new GitState
            {
                Revision = revision.Trim(),
                IsDirty = !string.IsNullOrWhiteSpace(status)
            };
        }

        private static string RunGit(string workingDirectory, string arguments)
        {
            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = "git",
                    Arguments = arguments,
                    WorkingDirectory = workingDirectory,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };
                using (var process = Process.Start(startInfo))
                {
                    if (process == null)
                    {
                        return string.Empty;
                    }

                    var output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit(5000);
                    return process.ExitCode == 0 ? output : string.Empty;
                }
            }
            catch (Exception exception)
            {
                Debug.LogWarning(
                    LogPrefix + "Git metadata unavailable: " + exception.Message);
                return string.Empty;
            }
        }

        private static void RunCommand(Action action)
        {
            try
            {
                action();
                if (Application.isBatchMode)
                {
                    EditorApplication.Exit(0);
                }
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                if (Application.isBatchMode)
                {
                    EditorApplication.Exit(1);
                    return;
                }

                throw;
            }
        }

        private sealed class TurntableView
        {
            public TurntableView(string label, string relativePath, Vector3 position)
            {
                Label = label;
                RelativePath = relativePath;
                Position = position;
            }

            public string Label { get; }
            public string RelativePath { get; }
            public Vector3 Position { get; }
        }

        private sealed class HeroTelemetry
        {
            public int MeshCount;
            public int RendererCount;
            public int TriangleCount;
            public string[] MaterialNames;
            public float ScreenHeightFraction;
        }

        private sealed class GitState
        {
            public string Revision;
            public bool IsDirty;
        }
    }
}
