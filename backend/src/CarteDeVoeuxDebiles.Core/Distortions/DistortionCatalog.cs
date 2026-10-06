namespace CarteDeVoeuxDebiles.Core.Distortions;

public sealed class DistortionCatalog
{
    private readonly Dictionary<string, IDistortion> _byId;

    public DistortionCatalog(IEnumerable<IDistortion> distortions)
    {
        All = distortions.ToList();
        _byId = All.ToDictionary(d => d.Id, StringComparer.OrdinalIgnoreCase);
    }

    public static DistortionCatalog Default { get; } = new(
    [
        new NoDistortion(),
        new BulgeDistortion(),
        new PinchDistortion(),
        new SwirlDistortion(),
        new EggHeadDistortion(),
        new PancakeDistortion(),
        new WaveDistortion(),
        new MeltDistortion(),
        new ExtremeDistortion(),
        new QuadrupletsDistortion(),
    ]);

    public IReadOnlyList<IDistortion> All { get; }

    public bool TryGet(string id, out IDistortion distortion) => _byId.TryGetValue(id, out distortion!);
}
