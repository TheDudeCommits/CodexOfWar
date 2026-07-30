using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace CodexOfWar.Review
{
    public static class P00CaptureContract
    {
        public const string SchemaVersion = "1.0";
        public const string Piece = "P00";
        public const int Round = 1;
        public const string Preset = "S01_Explore";
        public const int Seed = 24007001;
        public const int Width = 1600;
        public const int Height = 900;
        public const string SceneAssetPath =
            "Assets/CodexOfWar/Review/Scenes/P00_EvidenceSpine.unity";
        public const string LatestManifestRelativePath =
            "data/capture-manifest-latest.json";

        public static string CaptureRelativePath =>
            BuildCaptureRelativePath(Piece, Round, Preset);

        public static string RoundManifestRelativePath =>
            BuildManifestRelativePath(Piece, Round);

        public static string BuildCaptureRelativePath(
            string piece,
            int round,
            string preset)
        {
            ValidateToken(piece, nameof(piece));
            ValidateToken(preset, nameof(preset));
            if (round < 1)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(round),
                    "Review rounds are one-based.");
            }

            return string.Format(
                CultureInfo.InvariantCulture,
                "captures/{0}/round-{1:000}/{2}.png",
                piece,
                round,
                preset);
        }

        public static string BuildManifestRelativePath(string piece, int round)
        {
            ValidateToken(piece, nameof(piece));
            if (round < 1)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(round),
                    "Review rounds are one-based.");
            }

            return string.Format(
                CultureInfo.InvariantCulture,
                "data/{0}-round-{1:000}-manifest.json",
                piece,
                round);
        }

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
                CaptureRelativePath);
            return Sha256(Encoding.UTF8.GetBytes(canonical));
        }

        public static string Sha256(byte[] bytes)
        {
            if (bytes == null)
            {
                throw new ArgumentNullException(nameof(bytes));
            }

            using (var algorithm = SHA256.Create())
            {
                var hash = algorithm.ComputeHash(bytes);
                var builder = new StringBuilder(hash.Length * 2);
                foreach (var value in hash)
                {
                    builder.Append(value.ToString("x2", CultureInfo.InvariantCulture));
                }

                return builder.ToString();
            }
        }

        private static void ValidateToken(string token, string parameterName)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                throw new ArgumentException(
                    "Capture path tokens cannot be empty.",
                    parameterName);
            }

            foreach (var character in token)
            {
                if (!char.IsLetterOrDigit(character) &&
                    character != '_' &&
                    character != '-')
                {
                    throw new ArgumentException(
                        "Capture path tokens may contain only letters, digits, '_' and '-'.",
                        parameterName);
                }
            }
        }
    }

    [Serializable]
    public sealed class CaptureResolution
    {
        public int width;
        public int height;
    }

    [Serializable]
    public sealed class CaptureMachineProfile
    {
        public string operatingSystem;
        public string deviceModel;
        public string processor;
        public int systemMemoryMb;
        public string graphicsDevice;
        public string graphicsApi;
    }

    [Serializable]
    public sealed class CaptureManifest
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
        public string scene;
        public int seed;
        public string preset;
        public CaptureResolution resolution;
        public string capturedAtUtc;
        public CaptureMachineProfile machineProfile;
        public string screenshotRelativePath;
        public string screenshotSha256;
        public string captureContractSha256;
    }

    public static class CaptureManifestValidator
    {
        public static IReadOnlyList<string> Validate(
            CaptureManifest manifest,
            byte[] screenshotBytes)
        {
            var errors = new List<string>();
            if (manifest == null)
            {
                errors.Add("Manifest is missing.");
                return errors;
            }

            RequireEqual(
                errors,
                "schemaVersion",
                P00CaptureContract.SchemaVersion,
                manifest.schemaVersion);
            RequireEqual(errors, "piece", P00CaptureContract.Piece, manifest.piece);
            RequireEqual(errors, "round", P00CaptureContract.Round, manifest.round);
            RequireEqual(
                errors,
                "scene",
                P00CaptureContract.SceneAssetPath,
                manifest.scene);
            RequireEqual(errors, "seed", P00CaptureContract.Seed, manifest.seed);
            RequireEqual(
                errors,
                "preset",
                P00CaptureContract.Preset,
                manifest.preset);
            RequireEqual(
                errors,
                "screenshotRelativePath",
                P00CaptureContract.CaptureRelativePath,
                manifest.screenshotRelativePath);
            RequireEqual(
                errors,
                "captureContractSha256",
                P00CaptureContract.BuildContractHash(),
                manifest.captureContractSha256);

            if (manifest.resolution == null)
            {
                errors.Add("resolution is missing.");
            }
            else
            {
                RequireEqual(
                    errors,
                    "resolution.width",
                    P00CaptureContract.Width,
                    manifest.resolution.width);
                RequireEqual(
                    errors,
                    "resolution.height",
                    P00CaptureContract.Height,
                    manifest.resolution.height);
            }

            RequireNonEmpty(errors, "gitRevision", manifest.gitRevision);
            RequireNonEmpty(errors, "unityVersion", manifest.unityVersion);
            RequireNonEmpty(errors, "urpVersion", manifest.urpVersion);
            RequireNonEmpty(
                errors,
                "renderPipelineAsset",
                manifest.renderPipelineAsset);
            RequireSha256(
                errors,
                "renderSettingsSha256",
                manifest.renderSettingsSha256);
            RequireSha256(
                errors,
                "screenshotSha256",
                manifest.screenshotSha256);

            DateTime timestamp;
            if (!DateTime.TryParse(
                    manifest.capturedAtUtc,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal |
                    DateTimeStyles.AssumeUniversal,
                    out timestamp) ||
                timestamp.Kind != DateTimeKind.Utc)
            {
                errors.Add("capturedAtUtc is not a valid UTC timestamp.");
            }

            if (manifest.machineProfile == null)
            {
                errors.Add("machineProfile is missing.");
            }
            else
            {
                RequireNonEmpty(
                    errors,
                    "machineProfile.processor",
                    manifest.machineProfile.processor);
                RequireNonEmpty(
                    errors,
                    "machineProfile.graphicsDevice",
                    manifest.machineProfile.graphicsDevice);
                if (manifest.machineProfile.systemMemoryMb <= 0)
                {
                    errors.Add("machineProfile.systemMemoryMb must be positive.");
                }
            }

            if (screenshotBytes == null || screenshotBytes.Length == 0)
            {
                errors.Add("Screenshot bytes are missing.");
            }
            else
            {
                var actualHash = P00CaptureContract.Sha256(screenshotBytes);
                if (!string.Equals(
                        actualHash,
                        manifest.screenshotSha256,
                        StringComparison.Ordinal))
                {
                    errors.Add("screenshotSha256 does not match the screenshot.");
                }
            }

            return errors;
        }

        private static void RequireNonEmpty(
            ICollection<string> errors,
            string field,
            string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add(field + " is missing.");
            }
        }

        private static void RequireSha256(
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
                var valid =
                    character >= '0' && character <= '9' ||
                    character >= 'a' && character <= 'f';
                if (!valid)
                {
                    errors.Add(field + " must be a lowercase 64-character SHA-256.");
                    return;
                }
            }
        }

        private static void RequireEqual<T>(
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
