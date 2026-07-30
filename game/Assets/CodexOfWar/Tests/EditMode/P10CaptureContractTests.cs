using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using CodexOfWar.Review;
using NUnit.Framework;

namespace CodexOfWar.Tests.EditMode
{
    public sealed class P10CaptureContractTests
    {
        private static readonly string[] MaterialNames =
        {
            "P10_ClothLeather",
            "P10_Glow",
            "P10_Hair",
            "P10_Metal",
            "P10_Skin"
        };

        [Test]
        public void Paths_ArePinnedToRound001AndPortable()
        {
            Assert.That(
                P10CaptureContract.CaptureRelativePath,
                Is.EqualTo("captures/P10/round-001/S01_Explore.png"));
            Assert.That(
                P10CaptureContract.RoundManifestRelativePath,
                Is.EqualTo("data/P10-round-001-manifest.json"));
            Assert.That(
                P10CaptureContract.TurntableContactSheetRelativePath,
                Does.Not.Contain("\\"));
        }

        [Test]
        public void ContractHash_IsDeterministicLowercaseSha256()
        {
            var first = P10CaptureContract.BuildContractHash();
            var second = P10CaptureContract.BuildContractHash();

            Assert.That(first, Is.EqualTo(second));
            Assert.That(first, Has.Length.EqualTo(64));
            Assert.That(
                first.All(
                    character =>
                        character >= '0' && character <= '9' ||
                        character >= 'a' && character <= 'f'),
                Is.True);
        }

        [Test]
        public void Validator_AcceptsCanonicalBundle()
        {
            var bundle = CreateValidBundle();

            var errors = P10ManifestValidator.Validate(
                bundle.Manifest,
                bundle.Screenshot,
                bundle.TurntableBytes,
                bundle.SourceBytes);

            Assert.That(errors, Is.Empty);
        }

        [Test]
        public void Validator_DetectsLockedCameraDrift()
        {
            var bundle = CreateValidBundle();
            bundle.Manifest.camera.positionX += 0.01f;
            bundle.Manifest.camera.antialiasing = "None";

            var errors = Validate(bundle);

            Assert.That(
                errors.Any(error => error.StartsWith("camera.positionX expected")),
                Is.True);
            Assert.That(
                errors.Any(error => error.StartsWith("camera.antialiasing expected")),
                Is.True);
        }

        [Test]
        public void Validator_DetectsHeroBudgetAndFramingDrift()
        {
            var bundle = CreateValidBundle();
            bundle.Manifest.heroTriangleCount = 100001;
            bundle.Manifest.heroScreenHeightFraction = 0.239f;
            bundle.Manifest.heroMaterialCount = 4;

            var errors = Validate(bundle);

            Assert.That(
                errors,
                Does.Contain(
                    "heroTriangleCount must remain in the 50k-100k lookdev budget."));
            Assert.That(
                errors,
                Does.Contain(
                    "heroScreenHeightFraction must remain within the locked 24%-32% S01 contract."));
            Assert.That(
                errors,
                Does.Contain("heroMaterialCount must be exactly five."));
        }

        [Test]
        public void Validator_DetectsSourceCountAndHashDrift()
        {
            var bundle = CreateValidBundle();
            bundle.Manifest.sourceAssets =
                bundle.Manifest.sourceAssets.Take(7).ToArray();

            var countErrors = Validate(bundle);
            Assert.That(
                countErrors,
                Does.Contain(
                    "Exactly eight reproducible source asset records are required."));

            bundle = CreateValidBundle();
            bundle.SourceBytes["source-0"] = Encoding.UTF8.GetBytes("changed");
            var hashErrors = Validate(bundle);
            Assert.That(
                hashErrors.Any(
                    error => error.StartsWith("sourceAssets.sha256 expected")),
                Is.True);
        }

        [Test]
        public void Validator_DetectsTurntableCameraAndPngDrift()
        {
            var bundle = CreateValidBundle();
            bundle.Manifest.turntableImages[0].cameraPositionZ = -7.2f;
            bundle.TurntableBytes[
                    P10CaptureContract.TurntableFrontRelativePath] =
                FakePng(1599, 900, 99);

            var errors = Validate(bundle);

            Assert.That(
                errors.Any(
                    error => error.StartsWith(
                        "Front.cameraPositionZ expected")),
                Is.True);
            Assert.That(
                errors.Any(error => error.StartsWith("Front.width expected")),
                Is.True);
        }

        [Test]
        public void Validator_DetectsBaselineAndProxyDrift()
        {
            var bundle = CreateValidBundle();
            bundle.Manifest.p00SceneSha256After = new string('b', 64);
            bundle.Manifest.frozenEnvironmentSha256P10 =
                new string('c', 64);
            bundle.Manifest.baselineProfilePersistenceNote = "missing context";
            bundle.Manifest.proxyLeakageDetected = true;

            var errors = Validate(bundle);

            Assert.That(
                errors.Any(
                    error => error.StartsWith("p00SceneSha256After expected")),
                Is.True);
            Assert.That(
                errors.Any(
                    error => error.StartsWith(
                        "frozenEnvironmentSha256P10 expected")),
                Is.True);
            Assert.That(
                errors.Any(
                    error => error.StartsWith(
                        "baselineProfilePersistenceNote expected")),
                Is.True);
            Assert.That(
                errors,
                Does.Contain("proxyLeakageDetected must be false."));
        }

        private static IReadOnlyList<string> Validate(Bundle bundle)
        {
            return P10ManifestValidator.Validate(
                bundle.Manifest,
                bundle.Screenshot,
                bundle.TurntableBytes,
                bundle.SourceBytes);
        }

        private static Bundle CreateValidBundle()
        {
            var screenshot = FakePng(1600, 900, 1);
            var turntableBytes = new Dictionary<string, byte[]>(
                StringComparer.Ordinal);
            var turntable = new[]
            {
                Turntable(
                    "Front",
                    P10CaptureContract.TurntableFrontRelativePath,
                    0.0f,
                    1.95f,
                    8.2f,
                    2),
                Turntable(
                    "Three-quarter",
                    P10CaptureContract.TurntableThreeQuarterRelativePath,
                    -5.7983f,
                    2.05f,
                    5.7983f,
                    3),
                Turntable(
                    "Back",
                    P10CaptureContract.TurntableBackRelativePath,
                    0.0f,
                    1.95f,
                    -8.2f,
                    4),
                Turntable(
                    "Profile",
                    P10CaptureContract.TurntableProfileRelativePath,
                    8.2f,
                    1.95f,
                    0.0f,
                    5),
                Turntable(
                    "Four-view contact sheet",
                    P10CaptureContract.TurntableContactSheetRelativePath,
                    0.0f,
                    0.0f,
                    0.0f,
                    6)
            };
            foreach (var image in turntable)
            {
                turntableBytes[image.relativePath] =
                    FakePng(image.width, image.height, image.label[0]);
                image.sha256 = P00CaptureContract.Sha256(
                    turntableBytes[image.relativePath]);
            }

            var sourceBytes = new Dictionary<string, byte[]>(
                StringComparer.Ordinal);
            var sources = new P10AssetEvidence[8];
            for (var index = 0; index < sources.Length; index++)
            {
                var path = "source-" + index;
                var bytes = Encoding.UTF8.GetBytes("source-bytes-" + index);
                sourceBytes[path] = bytes;
                sources[index] = new P10AssetEvidence
                {
                    repositoryPath = path,
                    unityAssetPath = string.Empty,
                    sha256 = P00CaptureContract.Sha256(bytes),
                    origin = "Original project source",
                    license = "Repository redistribution permitted",
                    modificationRecord = "Deterministic fixture"
                };
            }

            return new Bundle
            {
                Screenshot = screenshot,
                TurntableBytes = turntableBytes,
                SourceBytes = sourceBytes,
                Manifest = new P10CaptureManifest
                {
                    schemaVersion = P10CaptureContract.SchemaVersion,
                    piece = P10CaptureContract.Piece,
                    round = P10CaptureContract.Round,
                    gitRevision = "working-tree",
                    workingTree = true,
                    gitState = "working-tree",
                    unityVersion = "6000.5.4f1",
                    urpVersion = "17.5.0",
                    renderPipelineAsset = "Assets/Settings/PC_RPAsset.asset",
                    renderSettingsSha256 =
                        P10CaptureContract.ExpectedRenderSettingsSha256,
                    p00BaselineScreenshotSha256 =
                        P10CaptureContract.ExpectedP00ScreenshotSha256,
                    p00BaselineRenderSettingsSha256 =
                        P10CaptureContract.ExpectedRenderSettingsSha256,
                    p00SceneSha256Before = new string('a', 64),
                    p00SceneSha256After = new string('a', 64),
                    frozenEnvironmentSha256P00 = new string('b', 64),
                    frozenEnvironmentSha256P10 = new string('b', 64),
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
                    camera = LockedCamera(),
                    capturedAtUtc = "2026-07-31T00:00:00.000Z",
                    machineProfile = new CaptureMachineProfile
                    {
                        operatingSystem = "macOS",
                        deviceModel = "Mac",
                        processor = "Apple M2",
                        systemMemoryMb = 8192,
                        graphicsDevice = "Apple M2",
                        graphicsApi = "Metal"
                    },
                    screenshotRelativePath =
                        P10CaptureContract.CaptureRelativePath,
                    screenshotSha256 =
                        P00CaptureContract.Sha256(screenshot),
                    captureContractSha256 =
                        P10CaptureContract.BuildContractHash(),
                    heroAssetPath = P10CaptureContract.HeroModelAssetPath,
                    heroAssetGuid = "fixture-guid",
                    heroMeshCount = 2,
                    heroRendererCount = 2,
                    heroTriangleCount = 82906,
                    heroMaterialCount = 5,
                    heroScreenHeightFraction = 0.298f,
                    heroMaterialNames = MaterialNames,
                    proxyLeakageDetected = false,
                    sourceAssets = sources,
                    turntableImages = turntable
                }
            };
        }

        private static P10CameraProfile LockedCamera()
        {
            return new P10CameraProfile
            {
                positionX = P10CaptureContract.CameraPositionX,
                positionY = P10CaptureContract.CameraPositionY,
                positionZ = P10CaptureContract.CameraPositionZ,
                rotationX = P10CaptureContract.CameraRotationX,
                rotationY = P10CaptureContract.CameraRotationY,
                rotationZ = P10CaptureContract.CameraRotationZ,
                rotationW = P10CaptureContract.CameraRotationW,
                fieldOfView = P10CaptureContract.CameraFieldOfView,
                nearClip = P10CaptureContract.CameraNearClip,
                farClip = P10CaptureContract.CameraFarClip,
                hdr = true,
                msaa = true,
                postProcessing = true,
                antialiasing =
                    "SubpixelMorphologicalAntiAliasing",
                antialiasingQuality = "High",
                dithering = true,
                occlusionCulling = false
            };
        }

        private static P10ImageEvidence Turntable(
            string label,
            string path,
            float x,
            float y,
            float z,
            byte marker)
        {
            return new P10ImageEvidence
            {
                label = label,
                relativePath = path,
                sha256 = P00CaptureContract.Sha256(FakePng(1600, 900, marker)),
                width = 1600,
                height = 900,
                cameraPositionX = x,
                cameraPositionY = y,
                cameraPositionZ = z,
                targetX = label == "Four-view contact sheet"
                    ? 0.0f
                    : P10CaptureContract.TurntableTargetX,
                targetY = label == "Four-view contact sheet"
                    ? 0.0f
                    : P10CaptureContract.TurntableTargetY,
                targetZ = label == "Four-view contact sheet"
                    ? 0.0f
                    : P10CaptureContract.TurntableTargetZ,
                fieldOfView = label == "Four-view contact sheet"
                    ? 0.0f
                    : P10CaptureContract.TurntableFieldOfView
            };
        }

        private static byte[] FakePng(int width, int height, int marker)
        {
            var bytes = new byte[25];
            bytes[0] = 137;
            bytes[1] = 80;
            bytes[2] = 78;
            bytes[3] = 71;
            bytes[16] = (byte)(width >> 24);
            bytes[17] = (byte)(width >> 16);
            bytes[18] = (byte)(width >> 8);
            bytes[19] = (byte)width;
            bytes[20] = (byte)(height >> 24);
            bytes[21] = (byte)(height >> 16);
            bytes[22] = (byte)(height >> 8);
            bytes[23] = (byte)height;
            bytes[24] = (byte)marker;
            return bytes;
        }

        private sealed class Bundle
        {
            public P10CaptureManifest Manifest;
            public byte[] Screenshot;
            public Dictionary<string, byte[]> TurntableBytes;
            public Dictionary<string, byte[]> SourceBytes;
        }
    }
}
