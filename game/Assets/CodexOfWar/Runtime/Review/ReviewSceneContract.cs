using UnityEngine;

namespace CodexOfWar.Review
{
    [DisallowMultipleComponent]
    public sealed class ReviewSceneContract : MonoBehaviour
    {
        [SerializeField] private string piece = P00CaptureContract.Piece;
        [SerializeField] private int round = P00CaptureContract.Round;
        [SerializeField] private string preset = P00CaptureContract.Preset;
        [SerializeField] private int seed = P00CaptureContract.Seed;
        [SerializeField] private Vector2Int resolution =
            new Vector2Int(P00CaptureContract.Width, P00CaptureContract.Height);

        public string Piece => piece;
        public int Round => round;
        public string Preset => preset;
        public int Seed => seed;
        public Vector2Int Resolution => resolution;

        public void Configure(
            string pieceId,
            int reviewRound,
            string capturePreset,
            int captureSeed,
            Vector2Int captureResolution)
        {
            piece = pieceId;
            round = reviewRound;
            preset = capturePreset;
            seed = captureSeed;
            resolution = captureResolution;
        }
    }
}
