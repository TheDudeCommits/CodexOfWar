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
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;

namespace CodexOfWar.Editor.Review
{
    public static class P00CaptureCommand
    {
        private const string LogPrefix = "[P00 Capture] ";

        [MenuItem("Codex of War/Review/Capture P00 S01 Explore")]
        public static void CaptureS01FromCommandLine()
        {
            RunCommand(
                () =>
                {
                    var camera = P00ReviewSceneBuilder.BuildAndSave();
                    var manifest = Capture(camera);
                    var errors = ValidateCaptureBundle();
                    if (errors.Count > 0)
                    {
                        throw new InvalidOperationException(
                            "Capture validation failed:\n- " +
                            string.Join("\n- ", errors));
                    }

                    Debug.Log(
                        LogPrefix +
                        "PASS " +
                        manifest.screenshotRelativePath +
                        " sha256=" +
                        manifest.screenshotSha256);
                });
        }

        [MenuItem("Codex of War/Review/Validate P00 Evidence")]
        public static void ValidateFromCommandLine()
        {
            RunCommand(
                () =>
                {
                    var errors = ValidateCaptureBundle();
                    if (errors.Count > 0)
                    {
                        throw new InvalidOperationException(
                            "Evidence validation failed:\n- " +
                            string.Join("\n- ", errors));
                    }

                    Debug.Log(LogPrefix + "validation PASS");
                });
        }

        private static CaptureManifest Capture(Camera camera)
        {
            if (camera == null)
            {
                throw new ArgumentNullException(nameof(camera));
            }

            QualitySettings.vSyncCount = 0;
            UnityEngine.Random.InitState(P00CaptureContract.Seed);

            var renderTexture = new RenderTexture(
                P00CaptureContract.Width,
                P00CaptureContract.Height,
                24,
                RenderTextureFormat.ARGB32,
                RenderTextureReadWrite.sRGB)
            {
                name = "P00_S01_Explore_1600x900",
                antiAliasing = 1,
                useMipMap = false,
                autoGenerateMips = false,
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };
            renderTexture.Create();

            var previousActive = RenderTexture.active;
            var previousTarget = camera.targetTexture;
            Texture2D captureTexture = null;
            try
            {
                camera.aspect =
                    P00CaptureContract.Width / (float)P00CaptureContract.Height;
                camera.targetTexture = renderTexture;
                RenderTexture.active = renderTexture;
                GL.Clear(true, true, Color.black);

                camera.Render();

                captureTexture = new Texture2D(
                    P00CaptureContract.Width,
                    P00CaptureContract.Height,
                    TextureFormat.RGBA32,
                    false,
                    false);
                captureTexture.ReadPixels(
                    new Rect(
                        0,
                        0,
                        P00CaptureContract.Width,
                        P00CaptureContract.Height),
                    0,
                    0,
                    false);
                captureTexture.Apply(false, false);

                var pngBytes = captureTexture.EncodeToPNG();
                if (pngBytes == null || pngBytes.Length == 0)
                {
                    throw new InvalidOperationException(
                        "Unity returned an empty PNG payload.");
                }

                var publicRoot = GetProgressPublicRoot();
                var screenshotPath = ResolveUnderPublicRoot(
                    publicRoot,
                    P00CaptureContract.CaptureRelativePath);
                WriteBytesAtomically(screenshotPath, pngBytes);

                var manifest = BuildManifest(pngBytes);
                var json = JsonUtility.ToJson(manifest, true) + "\n";
                var jsonBytes = new UTF8Encoding(false).GetBytes(json);
                WriteBytesAtomically(
                    ResolveUnderPublicRoot(
                        publicRoot,
                        P00CaptureContract.RoundManifestRelativePath),
                    jsonBytes);
                WriteBytesAtomically(
                    ResolveUnderPublicRoot(
                        publicRoot,
                        P00CaptureContract.LatestManifestRelativePath),
                    jsonBytes);

                Debug.Log(
                    LogPrefix +
                    "rendered through " +
                    GraphicsSettings.currentRenderPipeline?.GetType().Name +
                    " at " +
                    P00CaptureContract.Width +
                    "x" +
                    P00CaptureContract.Height);
                return manifest;
            }
            finally
            {
                camera.targetTexture = previousTarget;
                RenderTexture.active = previousActive;
                if (captureTexture != null)
                {
                    Object.DestroyImmediate(captureTexture);
                }

                renderTexture.Release();
                Object.DestroyImmediate(renderTexture);
            }
        }

        private static CaptureManifest BuildManifest(byte[] pngBytes)
        {
            var git = ReadGitState(GetRepositoryRoot());
            var pipeline = GraphicsSettings.currentRenderPipeline;
            if (pipeline == null)
            {
                pipeline = QualitySettings.renderPipeline;
            }

            if (pipeline == null)
            {
                throw new InvalidOperationException(
                    "No active Scriptable Render Pipeline asset is configured.");
            }

            var pipelineAssetPath = AssetDatabase.GetAssetPath(pipeline);
            var urpPackage = UnityEditor.PackageManager.PackageInfo.FindForAssembly(
                typeof(UniversalRenderPipelineAsset).Assembly);
            var urpVersion = urpPackage != null ? urpPackage.version : "unknown";

            return new CaptureManifest
            {
                schemaVersion = P00CaptureContract.SchemaVersion,
                piece = P00CaptureContract.Piece,
                round = P00CaptureContract.Round,
                gitRevision = git.Revision,
                workingTree = git.IsDirty,
                gitState = git.IsDirty ? "working-tree" : "clean",
                unityVersion = Application.unityVersion,
                urpVersion = urpVersion,
                renderPipelineAsset = pipelineAssetPath,
                renderSettingsSha256 = ComputeRenderSettingsHash(
                    pipelineAssetPath,
                    urpVersion),
                scene = P00CaptureContract.SceneAssetPath,
                seed = P00CaptureContract.Seed,
                preset = P00CaptureContract.Preset,
                resolution = new CaptureResolution
                {
                    width = P00CaptureContract.Width,
                    height = P00CaptureContract.Height
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
                screenshotRelativePath = P00CaptureContract.CaptureRelativePath,
                screenshotSha256 = P00CaptureContract.Sha256(pngBytes),
                captureContractSha256 = P00CaptureContract.BuildContractHash()
            };
        }

        private static string ComputeRenderSettingsHash(
            string pipelineAssetPath,
            string urpVersion)
        {
            if (string.IsNullOrWhiteSpace(pipelineAssetPath))
            {
                throw new InvalidOperationException(
                    "The active URP asset does not have a project path.");
            }

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
                var absolutePath = Path.GetFullPath(
                    Path.Combine(
                        projectRoot,
                        path.Replace('/', Path.DirectorySeparatorChar)));
                if (!File.Exists(absolutePath))
                {
                    throw new FileNotFoundException(
                        "A render-settings input is missing.",
                        absolutePath);
                }

                canonical
                    .Append(path)
                    .Append('=')
                    .Append(
                        P00CaptureContract.Sha256(
                            File.ReadAllBytes(absolutePath)))
                    .Append('\n');
            }

            canonical
                .Append("colorSpace=")
                .Append(PlayerSettings.colorSpace)
                .Append('\n')
                .Append("quality=")
                .Append(QualitySettings.names[QualitySettings.GetQualityLevel()])
                .Append('\n');

            return P00CaptureContract.Sha256(
                Encoding.UTF8.GetBytes(canonical.ToString()));
        }

        private static List<string> ValidateCaptureBundle()
        {
            var errors = new List<string>();
            var publicRoot = GetProgressPublicRoot();
            var screenshotPath = ResolveUnderPublicRoot(
                publicRoot,
                P00CaptureContract.CaptureRelativePath);
            var manifestPath = ResolveUnderPublicRoot(
                publicRoot,
                P00CaptureContract.RoundManifestRelativePath);
            var latestManifestPath = ResolveUnderPublicRoot(
                publicRoot,
                P00CaptureContract.LatestManifestRelativePath);

            if (!File.Exists(P00CaptureContract.SceneAssetPath))
            {
                errors.Add(
                    "Review scene is missing: " +
                    P00CaptureContract.SceneAssetPath);
            }

            if (!File.Exists(screenshotPath))
            {
                errors.Add("Screenshot is missing: " + screenshotPath);
                return errors;
            }

            if (!File.Exists(manifestPath))
            {
                errors.Add("Round manifest is missing: " + manifestPath);
                return errors;
            }

            if (!File.Exists(latestManifestPath))
            {
                errors.Add("Latest manifest is missing: " + latestManifestPath);
            }

            var screenshotBytes = File.ReadAllBytes(screenshotPath);
            CaptureManifest manifest;
            try
            {
                manifest = JsonUtility.FromJson<CaptureManifest>(
                    File.ReadAllText(manifestPath, Encoding.UTF8));
            }
            catch (Exception exception)
            {
                errors.Add("Manifest JSON could not be parsed: " + exception.Message);
                return errors;
            }

            errors.AddRange(
                CaptureManifestValidator.Validate(manifest, screenshotBytes));

            if (File.Exists(latestManifestPath) &&
                !File.ReadAllBytes(manifestPath)
                    .SequenceEqual(File.ReadAllBytes(latestManifestPath)))
            {
                errors.Add(
                    "Latest manifest is not byte-identical to the round manifest.");
            }

            ValidateImage(screenshotBytes, errors);
            ValidateScene(errors);
            return errors;
        }

        private static void ValidateImage(
            byte[] screenshotBytes,
            ICollection<string> errors)
        {
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            try
            {
                if (!texture.LoadImage(screenshotBytes, false))
                {
                    errors.Add("Screenshot PNG could not be decoded by Unity.");
                    return;
                }

                if (texture.width != P00CaptureContract.Width ||
                    texture.height != P00CaptureContract.Height)
                {
                    errors.Add(
                        string.Format(
                            CultureInfo.InvariantCulture,
                            "Screenshot dimensions are {0}x{1}; expected {2}x{3}.",
                            texture.width,
                            texture.height,
                            P00CaptureContract.Width,
                            P00CaptureContract.Height));
                    return;
                }

                var pixels = texture.GetPixels32();
                var step = Math.Max(1, pixels.Length / 12000);
                var minimumLuminance = 1.0f;
                var maximumLuminance = 0.0f;
                var luminanceSum = 0.0;
                var sampled = 0;
                var magenta = 0;
                for (var index = 0; index < pixels.Length; index += step)
                {
                    var color = pixels[index];
                    var red = color.r / 255.0f;
                    var green = color.g / 255.0f;
                    var blue = color.b / 255.0f;
                    var luminance =
                        red * 0.2126f + green * 0.7152f + blue * 0.0722f;
                    minimumLuminance = Mathf.Min(minimumLuminance, luminance);
                    maximumLuminance = Mathf.Max(maximumLuminance, luminance);
                    luminanceSum += luminance;
                    sampled++;

                    if (red > 0.82f && blue > 0.82f && green < 0.22f)
                    {
                        magenta++;
                    }
                }

                var meanLuminance = sampled > 0 ? luminanceSum / sampled : 0.0;
                if (maximumLuminance - minimumLuminance < 0.18f ||
                    meanLuminance < 0.025 ||
                    meanLuminance > 0.975)
                {
                    errors.Add(
                        "Screenshot appears blank or lacks sufficient tonal range.");
                }

                if (sampled > 0 && magenta / (double)sampled > 0.006)
                {
                    errors.Add(
                        "Screenshot contains a pink-shader signature above tolerance.");
                }
            }
            finally
            {
                Object.DestroyImmediate(texture);
            }
        }

        private static void ValidateScene(ICollection<string> errors)
        {
            var scene = EditorSceneManager.OpenScene(
                P00CaptureContract.SceneAssetPath,
                OpenSceneMode.Single);
            ReviewSceneContract contract = null;
            Camera reviewCamera = null;
            foreach (var root in scene.GetRootGameObjects())
            {
                if (contract == null)
                {
                    contract = root.GetComponentInChildren<ReviewSceneContract>(true);
                }

                if (reviewCamera == null)
                {
                    reviewCamera = root.GetComponentInChildren<Camera>(true);
                }
            }

            if (contract == null)
            {
                errors.Add("Review scene does not contain a ReviewSceneContract.");
            }
            else
            {
                if (contract.Seed != P00CaptureContract.Seed)
                {
                    errors.Add("Review scene seed does not match the capture contract.");
                }

                if (contract.Preset != P00CaptureContract.Preset)
                {
                    errors.Add(
                        "Review scene preset does not match the capture contract.");
                }

                if (contract.Resolution.x != P00CaptureContract.Width ||
                    contract.Resolution.y != P00CaptureContract.Height)
                {
                    errors.Add(
                        "Review scene resolution does not match the capture contract.");
                }
            }

            if (reviewCamera == null)
            {
                errors.Add("Review scene does not contain a Camera.");
            }
            else
            {
                if (reviewCamera.clearFlags != CameraClearFlags.Skybox)
                {
                    errors.Add("Review camera is not configured for an authored sky.");
                }

                if (reviewCamera.targetTexture != null)
                {
                    errors.Add(
                        "Review camera retained a temporary render texture reference.");
                }
            }
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

        private static string ResolveUnderPublicRoot(
            string publicRoot,
            string relativePath)
        {
            var normalizedRelative = relativePath.Replace(
                '/',
                Path.DirectorySeparatorChar);
            var resolved = Path.GetFullPath(Path.Combine(publicRoot, normalizedRelative));
            var rootPrefix = publicRoot.EndsWith(
                Path.DirectorySeparatorChar.ToString(),
                StringComparison.Ordinal)
                ? publicRoot
                : publicRoot + Path.DirectorySeparatorChar;
            if (!resolved.StartsWith(rootPrefix, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "Capture output escaped progress/public.");
            }

            return resolved;
        }

        private static void WriteBytesAtomically(string path, byte[] bytes)
        {
            var directory = Path.GetDirectoryName(path);
            if (string.IsNullOrEmpty(directory))
            {
                throw new InvalidOperationException(
                    "Output path did not have a directory: " + path);
            }

            Directory.CreateDirectory(directory);
            var temporaryPath = path + ".tmp";
            File.WriteAllBytes(temporaryPath, bytes);
            if (File.Exists(path))
            {
                File.Delete(path);
            }

            File.Move(temporaryPath, path);
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

        private sealed class GitState
        {
            public string Revision;
            public bool IsDirty;
        }
    }
}
