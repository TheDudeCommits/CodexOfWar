using UnityEngine;

namespace CodexOfWar.Review
{
    [DisallowMultipleComponent]
    public sealed class P10HeroMarker : MonoBehaviour
    {
        [SerializeField] private string heroId = "P10_ASTRA_VALE_ORIGINAL";
        [SerializeField] private string sourceAssetPath =
            P10CaptureContract.HeroModelAssetPath;
        [SerializeField] private int sourceSeed = P10CaptureContract.Seed;

        public string HeroId => heroId;
        public string SourceAssetPath => sourceAssetPath;
        public int SourceSeed => sourceSeed;

        public void Configure(string id, string assetPath, int seed)
        {
            heroId = id;
            sourceAssetPath = assetPath;
            sourceSeed = seed;
        }
    }
}
