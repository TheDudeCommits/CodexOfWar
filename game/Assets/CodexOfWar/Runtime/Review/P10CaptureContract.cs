using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;

namespace CodexOfWar.Review
{
    public static class P10CaptureContract
    {
        public const string SchemaVersion = "1.0";
        public const string Piece = "P10";
        public const int Round = 1;
        public const string Preset = P00CaptureContract.Preset;
        public const int Seed = P00CaptureContract.Seed;
        public const int Width = P00CaptureContract.Width;
        public const int Height = P00CaptureContract.Height;

        public const string SceneAssetPath =
            "Assets/CodexOfWar/Review/Scenes/P10_HeroLookdev.unity";
        public const string TurntableSceneAssetPath =
            "Assets/CodexOfWar/Review/Scenes/P10_HeroTurntable.unity";
        public const string HeroModelAssetPath =
            "Assets/CodexOfWar/Heroes/P10/Models/P10_AstraValeHero.fbx";
        public const string HeroBlenderSourceRepositoryPath =
            "ArtSource/P10/P10_AstraValeHero.blend";
        public const string HeroBlenderScriptRepositoryPath =
            "Tools/Blender/P10_AstraValeHero.py";
        public const string CaptureRelativePath =
            "captures/P10/round-001/S01_Explore.png";
        public const string RoundManifestRelativePath =
            "data/P10-round-001-manifest.json";
        public const string TurntableContactSheetRelativePath =
            "captures/P10/round-001/Turntable_ContactSheet.png";
        public const string TurntableFrontRelativePath =
            "captures/P10/round-001/Turntable_Front.png";
        public const string TurntableThreeQuarterRelativePath =
            "captures/P10/round-001/Turntable_ThreeQuarter.png";
        public const string TurntableBackRelativePath =
            "captures/P10/round-001/Turntable_Back.png";
        public const string TurntableProfileRelativePath =
            "captures/P10/round-001/Turntable_Profile.png";

        public const string ExpectedP00ScreenshotSha256 =
            "a54a917a70b537ed34f57f9cdf13b877dc58b9d9579e2b2ec10f1e184a525aab";
        public const string ExpectedRenderSettingsSha256 =
            "44c656be7394557e9bc93929faa2256ac71fe0f208d0e1206901f58ae73acc12";
        public const string ExpectedHeroFbxSha256 =
            "e301584e65e5b7c4c005771b93e5ec26e6342ed4af6b89b2db199cd017927af9";
        public const string ExpectedHeroBlendSha256 =
            "fe1da7c00f88300f081a5f9b4e65fcf98ab8d00fd8786d7b2f2a480d645902a5";
        public const string ExpectedHeroScriptSha256 =
            "ddbf261f4af9da3bd23376fd4e2b10bbcdb27f0fc7d7b0cda03a92b727a348c3";
        public const string BaselineProfilePersistenceNote =
            "The filed P00 volume contains null serialized component references; P10 persists an isolated profile with the original P00 builder grade and leaves every P00 byte untouched.";

        public const float CameraPositionX = -5.25f;
        public const float CameraPositionY = 3.02f;
        public const float CameraPositionZ = -13.8f;
        public const float CameraRotationX = 0.029533343f;
        public const float CameraRotationY = 0.19760646f;
        public const float CameraRotationZ = -0.005956185f;
        public const float CameraRotationW = 0.9798184f;
        public const float CameraFieldOfView = 50.0f;
        public const float CameraNearClip = 0.1f;
        public const float CameraFarClip = 105.0f;
        public const float TurntableFieldOfView = 35.0f;
        public const float TurntableTargetX = 0.0f;
        public const float TurntableTargetY = 1.54f;
        public const float TurntableTargetZ = 0.0f;

        public static string BuildContractHash()
        {
            var canonical = string.Join(
                "|",
                SchemaVersion,
                Piece,
                Round.ToString(CultureInfo.InvariantCulture),
                Preset,
                Seed.ToString(CultureInfo.InvariantCulture),
                Width.ToString(CultureInfo.InvariantCulture),
                Height.ToString(CultureInfo.InvariantCulture),
                SceneAssetPath,
                HeroModelAssetPath,
                CaptureRelativePath,
                BaselineProfilePersistenceNote,
                ExpectedP00ScreenshotSha256,
                ExpectedRenderSettingsSha256,
                Vector(CameraPositionX, CameraPositionY, CameraPositionZ),
                Quaternion(
                    CameraRotationX,
                    CameraRotationY,
                    CameraRotationZ,
                    CameraRotationW),
                CameraFieldOfView.ToString("R", CultureInfo.InvariantCulture),
                CameraNearClip.ToString("R", CultureInfo.InvariantCulture),
                CameraFarClip.ToString("R", CultureInfo.InvariantCulture));
            return P00CaptureContract.Sha256(Encoding.UTF8.GetBytes(canonical));
        }

        private static string Vector(float x, float y, float z)
        {
            return string.Join(
                ",",
                x.ToString("R", CultureInfo.InvariantCulture),
                y.ToString("R", CultureInfo.InvariantCulture),
                z.ToString("R", CultureInfo.InvariantCulture));
        }

        private static string Quaternion(float x, float y, float z, float w)
        {
            return string.Join(
                ",",
                x.ToString("R", CultureInfo.InvariantCulture),
                y.ToString("R", CultureInfo.InvariantCulture),
                z.ToString("R", CultureInfo.InvariantCulture),
                w.ToString("R", CultureInfo.InvariantCulture));
        }
    }

    [Serializable]
    public sealed class P10CameraProfile
    {
        public float positionX;
        public float positionY;
        public float positionZ;
        public float rotationX;
        public float rotationY;
        public float rotationZ;
        public float rotationW;
        public float fieldOfView;
        public float nearClip;
        public float farClip;
        public bool hdr;
        public bool msaa;
        public bool postProcessing;
        public string antialiasing;
        public string antialiasingQuality;
        public bool dithering;
        public bool occlusionCulling;
    }

    [Serializable]
    public sealed class P10AssetEvidence
    {
        public string repositoryPath;
        public string unityAssetPath;
        public string sha256;
        public string origin;
        public string license;
        public string modificationRecord;
    }

    [Serializable]
    public sealed class P10ImageEvidence
    {
        public string label;
        public string relativePath;
        public string sha256;
        public int width;
        public int height;
        public float cameraPositionX;
        public float cameraPositionY;
        public float cameraPositionZ;
        public float targetX;
        public float targetY;
        public float targetZ;
        public float fieldOfView;
    }

    [Serializable]
    public sealed class P10CaptureManifest
    {
        public string schemaVersion;
        public string piece;
        public int round;
        public string gitRevision;
        public bool workingTree;
        public string gitState;
        public string unityVersion;
        public string urpVersion;
        public string renderPipelineAsset;
        public string renderSettingsSha256;
        public string p00BaselineScreenshotSha256;
        public string p00BaselineRenderSettingsSha256;
        public string p00SceneSha256Before;
        public string p00SceneSha256After;
        public string frozenEnvironmentSha256P00;
        public string frozenEnvironmentSha256P10;
        public string baselineProfilePersistenceNote;
        public string scene;
        public int seed;
        public string preset;
        public CaptureResolution resolution;
        public P10CameraProfile camera;
        public string capturedAtUtc;
        public CaptureMachineProfile machineProfile;
        public string screenshotRelativePath;
        public string screenshotSha256;
        public string captureContractSha256;
        public string heroAssetPath;
        public string heroAssetGuid;
        public int heroMeshCount;
        public int heroRendererCount;
        public int heroTriangleCount;
        public int heroMaterialCount;
        public float heroScreenHeightFraction;
        public string[] heroMaterialNames;
        public bool proxyLeakageDetected;
        public P10AssetEvidence[] sourceAssets;
        public P10ImageEvidence[] turntableImages;
    }

    public static class P10ManifestValidator
    {
        public static IReadOnlyList<string> Validate(
            P10CaptureManifest manifest,
            byte[] screenshotBytes,
            IReadOnlyDictionary<string, byte[]> turntableBytes,
            IReadOnlyDictionary<string, byte[]> sourceAssetBytes)
        {
            var errors = new List<string>();
            if (manifest == null)
            {
                errors.Add("Manifest is missing.");
                return errors;
            }

            Equal(errors, "schemaVersion", P10CaptureContract.SchemaVersion, manifest.schemaVersion);
            Equal(errors, "piece", P10CaptureContract.Piece, manifest.piece);
            Equal(errors, "round", P10CaptureContract.Round, manifest.round);
            Equal(errors, "scene", P10CaptureContract.SceneAssetPath, manifest.scene);
            Equal(errors, "seed", P10CaptureContract.Seed, manifest.seed);
            Equal(errors, "preset", P10CaptureContract.Preset, manifest.preset);
            Equal(
                errors,
                "screenshotRelativePath",
                P10CaptureContract.CaptureRelativePath,
                manifest.screenshotRelativePath);
            Equal(
                errors,
                "captureContractSha256",
                P10CaptureContract.BuildContractHash(),
                manifest.captureContractSha256);
            Equal(
                errors,
                "p00BaselineScreenshotSha256",
                P10CaptureContract.ExpectedP00ScreenshotSha256,
                manifest.p00BaselineScreenshotSha256);
            Equal(
                errors,
                "p00BaselineRenderSettingsSha256",
                P10CaptureContract.ExpectedRenderSettingsSha256,
                manifest.p00BaselineRenderSettingsSha256);
            Equal(
                errors,
                "renderSettingsSha256",
                P10CaptureContract.ExpectedRenderSettingsSha256,
                manifest.renderSettingsSha256);
            Equal(
                errors,
                "baselineProfilePersistenceNote",
                P10CaptureContract.BaselineProfilePersistenceNote,
                manifest.baselineProfilePersistenceNote);
            Equal(
                errors,
                "heroAssetPath",
                P10CaptureContract.HeroModelAssetPath,
                manifest.heroAssetPath);

            if (manifest.resolution == null)
            {
                errors.Add("resolution is missing.");
            }
            else
            {
                Equal(errors, "resolution.width", P10CaptureContract.Width, manifest.resolution.width);
                Equal(errors, "resolution.height", P10CaptureContract.Height, manifest.resolution.height);
            }

            ValidateCamera(manifest.camera, errors);
            NonEmpty(errors, "gitRevision", manifest.gitRevision);
            NonEmpty(errors, "unityVersion", manifest.unityVersion);
            NonEmpty(errors, "urpVersion", manifest.urpVersion);
            NonEmpty(errors, "renderPipelineAsset", manifest.renderPipelineAsset);
            Sha(errors, "p00SceneSha256Before", manifest.p00SceneSha256Before);
            Sha(errors, "p00SceneSha256After", manifest.p00SceneSha256After);
            Equal(
                errors,
                "p00SceneSha256After",
                manifest.p00SceneSha256Before,
                manifest.p00SceneSha256After);
            Sha(errors, "frozenEnvironmentSha256P00", manifest.frozenEnvironmentSha256P00);
            Sha(errors, "frozenEnvironmentSha256P10", manifest.frozenEnvironmentSha256P10);
            Equal(
                errors,
                "frozenEnvironmentSha256P10",
                manifest.frozenEnvironmentSha256P00,
                manifest.frozenEnvironmentSha256P10);
            Sha(errors, "screenshotSha256", manifest.screenshotSha256);
            ValidateTimestamp(manifest.capturedAtUtc, errors);
            ValidateMachine(manifest.machineProfile, errors);
            ValidatePng(
                "S01 screenshot",
                screenshotBytes,
                P10CaptureContract.Width,
                P10CaptureContract.Height,
                manifest.screenshotSha256,
                errors);

            if (manifest.proxyLeakageDetected)
            {
                errors.Add("proxyLeakageDetected must be false.");
            }

            if (manifest.heroMeshCount != 2)
            {
                errors.Add("heroMeshCount must be exactly two delivery meshes.");
            }

            if (manifest.heroRendererCount != 2)
            {
                errors.Add("heroRendererCount must be exactly two.");
            }

            if (manifest.heroTriangleCount < 50000 ||
                manifest.heroTriangleCount > 100000)
            {
                errors.Add(
                    "heroTriangleCount must remain in the 50k-100k lookdev budget.");
            }

            if (manifest.heroScreenHeightFraction < 0.24f ||
                manifest.heroScreenHeightFraction > 0.32f)
            {
                errors.Add(
                    "heroScreenHeightFraction must remain within the locked 24%-32% S01 contract.");
            }

            if (manifest.heroMaterialCount != 5)
            {
                errors.Add("heroMaterialCount must be exactly five.");
            }

            ValidateMaterialNames(manifest.heroMaterialNames, errors);
            ValidateSources(manifest.sourceAssets, sourceAssetBytes, errors);
            ValidateTurntable(manifest.turntableImages, turntableBytes, errors);
            return errors;
        }

        private static void ValidateCamera(
            P10CameraProfile camera,
            ICollection<string> errors)
        {
            if (camera == null)
            {
                errors.Add("camera is missing.");
                return;
            }

            Close(errors, "camera.positionX", P10CaptureContract.CameraPositionX, camera.positionX);
            Close(errors, "camera.positionY", P10CaptureContract.CameraPositionY, camera.positionY);
            Close(errors, "camera.positionZ", P10CaptureContract.CameraPositionZ, camera.positionZ);
            Close(errors, "camera.rotationX", P10CaptureContract.CameraRotationX, camera.rotationX);
            Close(errors, "camera.rotationY", P10CaptureContract.CameraRotationY, camera.rotationY);
            Close(errors, "camera.rotationZ", P10CaptureContract.CameraRotationZ, camera.rotationZ);
            Close(errors, "camera.rotationW", P10CaptureContract.CameraRotationW, camera.rotationW);
            Close(errors, "camera.fieldOfView", P10CaptureContract.CameraFieldOfView, camera.fieldOfView);
            Close(errors, "camera.nearClip", P10CaptureContract.CameraNearClip, camera.nearClip);
            Close(errors, "camera.farClip", P10CaptureContract.CameraFarClip, camera.farClip);
            if (!camera.hdr || !camera.msaa || !camera.postProcessing || !camera.dithering)
            {
                errors.Add("camera HDR/MSAA/post-processing/dithering contract drifted.");
            }

            if (camera.occlusionCulling)
            {
                errors.Add("camera occlusion culling must remain disabled.");
            }

            Equal(errors, "camera.antialiasing", "SubpixelMorphologicalAntiAliasing", camera.antialiasing);
            Equal(errors, "camera.antialiasingQuality", "High", camera.antialiasingQuality);
        }

        private static void ValidateMaterialNames(
            IReadOnlyList<string> names,
            ICollection<string> errors)
        {
            var required = new[]
            {
                "P10_Skin",
                "P10_Hair",
                "P10_ClothLeather",
                "P10_Metal",
                "P10_Glow"
            };
            if (names == null)
            {
                errors.Add("heroMaterialNames is missing.");
                return;
            }

            foreach (var requiredName in required)
            {
                var found = false;
                foreach (var name in names)
                {
                    if (string.Equals(name, requiredName, StringComparison.Ordinal))
                    {
                        found = true;
                        break;
                    }
                }

                if (!found)
                {
                    errors.Add("Required hero material is missing: " + requiredName);
                }
            }
        }

        private static void ValidateSources(
            IReadOnlyList<P10AssetEvidence> assets,
            IReadOnlyDictionary<string, byte[]> bytesByPath,
            ICollection<string> errors)
        {
            if (assets == null || assets.Count != 8)
            {
                errors.Add("Exactly eight reproducible source asset records are required.");
                return;
            }

            foreach (var asset in assets)
            {
                if (asset == null)
                {
                    errors.Add("A source asset record is null.");
                    continue;
                }

                NonEmpty(errors, "sourceAssets.repositoryPath", asset.repositoryPath);
                NonEmpty(errors, "sourceAssets.origin", asset.origin);
                NonEmpty(errors, "sourceAssets.license", asset.license);
                Sha(errors, "sourceAssets.sha256", asset.sha256);
                byte[] bytes;
                if (bytesByPath == null ||
                    !bytesByPath.TryGetValue(asset.repositoryPath, out bytes) ||
                    bytes == null ||
                    bytes.Length == 0)
                {
                    errors.Add("Source asset bytes are missing: " + asset.repositoryPath);
                    continue;
                }

                Equal(
                    errors,
                    "sourceAssets.sha256",
                    P00CaptureContract.Sha256(bytes),
                    asset.sha256);
            }
        }

        private static void ValidateTurntable(
            IReadOnlyList<P10ImageEvidence> images,
            IReadOnlyDictionary<string, byte[]> bytesByPath,
            ICollection<string> errors)
        {
            if (images == null || images.Count != 5)
            {
                errors.Add("Five turntable image records are required.");
                return;
            }

            foreach (var image in images)
            {
                if (image == null)
                {
                    errors.Add("A turntable image record is null.");
                    continue;
                }

                byte[] bytes;
                if (bytesByPath == null ||
                    !bytesByPath.TryGetValue(image.relativePath, out bytes))
                {
                    errors.Add("Turntable image bytes are missing: " + image.relativePath);
                    continue;
                }

                ValidatePng(
                    image.label,
                    bytes,
                    image.width,
                    image.height,
                    image.sha256,
                    errors);
                ValidateTurntableCamera(image, errors);
            }
        }

        private static void ValidateTurntableCamera(
            P10ImageEvidence image,
            ICollection<string> errors)
        {
            if (string.Equals(
                    image.label,
                    "Four-view contact sheet",
                    StringComparison.Ordinal))
            {
                return;
            }

            Vector3 expected;
            switch (image.label)
            {
                case "Front":
                    expected = new Vector3(0.0f, 1.95f, 8.2f);
                    break;
                case "Three-quarter":
                    expected = new Vector3(-5.7983f, 2.05f, 5.7983f);
                    break;
                case "Back":
                    expected = new Vector3(0.0f, 1.95f, -8.2f);
                    break;
                case "Profile":
                    expected = new Vector3(8.2f, 1.95f, 0.0f);
                    break;
                default:
                    errors.Add("Unknown turntable view label: " + image.label);
                    return;
            }

            Close(errors, image.label + ".cameraPositionX", expected.x, image.cameraPositionX);
            Close(errors, image.label + ".cameraPositionY", expected.y, image.cameraPositionY);
            Close(errors, image.label + ".cameraPositionZ", expected.z, image.cameraPositionZ);
            Close(
                errors,
                image.label + ".targetX",
                P10CaptureContract.TurntableTargetX,
                image.targetX);
            Close(
                errors,
                image.label + ".targetY",
                P10CaptureContract.TurntableTargetY,
                image.targetY);
            Close(
                errors,
                image.label + ".targetZ",
                P10CaptureContract.TurntableTargetZ,
                image.targetZ);
            Close(
                errors,
                image.label + ".fieldOfView",
                P10CaptureContract.TurntableFieldOfView,
                image.fieldOfView);
        }

        private static void ValidatePng(
            string label,
            byte[] bytes,
            int width,
            int height,
            string expectedHash,
            ICollection<string> errors)
        {
            if (bytes == null || bytes.Length < 24)
            {
                errors.Add(label + " PNG bytes are missing.");
                return;
            }

            var png =
                bytes[0] == 137 &&
                bytes[1] == 80 &&
                bytes[2] == 78 &&
                bytes[3] == 71;
            if (!png)
            {
                errors.Add(label + " is not a PNG.");
                return;
            }

            var actualWidth =
                bytes[16] << 24 |
                bytes[17] << 16 |
                bytes[18] << 8 |
                bytes[19];
            var actualHeight =
                bytes[20] << 24 |
                bytes[21] << 16 |
                bytes[22] << 8 |
                bytes[23];
            Equal(errors, label + ".width", width, actualWidth);
            Equal(errors, label + ".height", height, actualHeight);
            Equal(
                errors,
                label + ".sha256",
                P00CaptureContract.Sha256(bytes),
                expectedHash);
        }

        private static void ValidateTimestamp(
            string timestamp,
            ICollection<string> errors)
        {
            DateTime parsed;
            if (!DateTime.TryParse(
                    timestamp,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out parsed) ||
                parsed.Kind != DateTimeKind.Utc)
            {
                errors.Add("capturedAtUtc is not a valid UTC timestamp.");
            }
        }

        private static void ValidateMachine(
            CaptureMachineProfile machine,
            ICollection<string> errors)
        {
            if (machine == null)
            {
                errors.Add("machineProfile is missing.");
                return;
            }

            NonEmpty(errors, "machineProfile.processor", machine.processor);
            NonEmpty(errors, "machineProfile.graphicsDevice", machine.graphicsDevice);
            Equal(errors, "machineProfile.graphicsApi", "Metal", machine.graphicsApi);
            if (machine.systemMemoryMb <= 0)
            {
                errors.Add("machineProfile.systemMemoryMb must be positive.");
            }
        }

        private static void NonEmpty(
            ICollection<string> errors,
            string field,
            string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add(field + " is missing.");
            }
        }

        private static void Sha(
            ICollection<string> errors,
            string field,
            string value)
        {
            if (string.IsNullOrEmpty(value) || value.Length != 64)
            {
                errors.Add(field + " must be a lowercase 64-character SHA-256.");
                return;
            }

            foreach (var character in value)
            {
                if (!(character >= '0' && character <= '9') &&
                    !(character >= 'a' && character <= 'f'))
                {
                    errors.Add(field + " must be a lowercase 64-character SHA-256.");
                    return;
                }
            }
        }

        private static void Close(
            ICollection<string> errors,
            string field,
            float expected,
            float actual)
        {
            if (Mathf.Abs(expected - actual) > 0.0001f)
            {
                errors.Add(
                    string.Format(
                        CultureInfo.InvariantCulture,
                        "{0} expected '{1:R}' but found '{2:R}'.",
                        field,
                        expected,
                        actual));
            }
        }

        private static void Equal<T>(
            ICollection<string> errors,
            string field,
            T expected,
            T actual)
        {
            if (!EqualityComparer<T>.Default.Equals(expected, actual))
            {
                errors.Add(
                    string.Format(
                        CultureInfo.InvariantCulture,
                        "{0} expected '{1}' but found '{2}'.",
                        field,
                        expected,
                        actual));
            }
        }
    }
}
