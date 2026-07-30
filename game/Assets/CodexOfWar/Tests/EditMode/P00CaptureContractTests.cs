using System;
using System.Linq;
using System.Text;
using CodexOfWar.Review;
using NUnit.Framework;
using UnityEngine;

namespace CodexOfWar.Tests.EditMode
{
    public sealed class P00CaptureContractTests
    {
        [Test]
        public void CanonicalPath_IsStableAndPortable()
        {
            Assert.That(
                P00CaptureContract.CaptureRelativePath,
                Is.EqualTo("captures/P00/round-001/S01_Explore.png"));
            Assert.That(
                P00CaptureContract.RoundManifestRelativePath,
                Is.EqualTo("data/P00-round-001-manifest.json"));
            Assert.That(
                P00CaptureContract.CaptureRelativePath,
                Does.Not.Contain("\\"));
        }

        [Test]
        public void PathBuilder_RejectsTraversalAndZeroRound()
        {
            Assert.Throws<ArgumentException>(
                () => P00CaptureContract.BuildCaptureRelativePath(
                    "../P00",
                    1,
                    "S01_Explore"));
            Assert.Throws<ArgumentException>(
                () => P00CaptureContract.BuildCaptureRelativePath(
                    "P00",
                    1,
                    "S01/Explore"));
            Assert.Throws<ArgumentOutOfRangeException>(
                () => P00CaptureContract.BuildCaptureRelativePath(
                    "P00",
                    0,
                    "S01_Explore"));
        }

        [Test]
        public void Sha256_MatchesPublishedTestVector()
        {
            var hash = P00CaptureContract.Sha256(Encoding.UTF8.GetBytes("abc"));
            Assert.That(
                hash,
                Is.EqualTo(
                    "ba7816bf8f01cfea414140de5dae2223" +
                    "b00361a396177a9cb410ff61f20015ad"));
        }

        [Test]
        public void ContractHash_IsDeterministicLowercaseSha256()
        {
            var first = P00CaptureContract.BuildContractHash();
            var second = P00CaptureContract.BuildContractHash();

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
        public void ManifestValidator_AcceptsCanonicalRoundTrip()
        {
            var screenshot = Encoding.UTF8.GetBytes("unity-rendered-png-fixture");
            var manifest = CreateValidManifest(screenshot);
            var json = JsonUtility.ToJson(manifest);
            var roundTripped = JsonUtility.FromJson<CaptureManifest>(json);

            var errors = CaptureManifestValidator.Validate(
                roundTripped,
                screenshot);

            Assert.That(errors, Is.Empty);
        }

        [Test]
        public void ManifestValidator_DetectsSeedPathAndHashDrift()
        {
            var screenshot = Encoding.UTF8.GetBytes("capture-a");
            var manifest = CreateValidManifest(screenshot);
            manifest.seed++;
            manifest.screenshotRelativePath =
                "captures/P00/round-002/S01_Explore.png";
            var changedScreenshot = Encoding.UTF8.GetBytes("capture-b");

            var errors = CaptureManifestValidator.Validate(
                manifest,
                changedScreenshot);

            Assert.That(errors.Any(error => error.StartsWith("seed expected")), Is.True);
            Assert.That(
                errors.Any(
                    error => error.StartsWith("screenshotRelativePath expected")),
                Is.True);
            Assert.That(
                errors,
                Does.Contain("screenshotSha256 does not match the screenshot."));
        }

        private static CaptureManifest CreateValidManifest(byte[] screenshot)
        {
            return new CaptureManifest
            {
                schemaVersion = P00CaptureContract.SchemaVersion,
                piece = P00CaptureContract.Piece,
                round = P00CaptureContract.Round,
                gitRevision = "working-tree",
                workingTree = true,
                gitState = "working-tree",
                unityVersion = "6000.5.4f1",
                urpVersion = "17.5.0",
                renderPipelineAsset = "Assets/Settings/PC_RPAsset.asset",
                renderSettingsSha256 = new string('a', 64),
                scene = P00CaptureContract.SceneAssetPath,
                seed = P00CaptureContract.Seed,
                preset = P00CaptureContract.Preset,
                resolution = new CaptureResolution
                {
                    width = P00CaptureContract.Width,
                    height = P00CaptureContract.Height
                },
                capturedAtUtc = DateTime.UtcNow.ToString("O"),
                machineProfile = new CaptureMachineProfile
                {
                    operatingSystem = "macOS",
                    deviceModel = "Mac",
                    processor = "Apple M2",
                    systemMemoryMb = 8192,
                    graphicsDevice = "Apple M2",
                    graphicsApi = "Metal"
                },
                screenshotRelativePath = P00CaptureContract.CaptureRelativePath,
                screenshotSha256 = P00CaptureContract.Sha256(screenshot),
                captureContractSha256 = P00CaptureContract.BuildContractHash()
            };
        }
    }
}
