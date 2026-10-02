using CarteDeVoeuxDebiles.Core.Imaging;

namespace CarteDeVoeuxDebiles.Core.Distortions;

public interface IDistortion
{
    /// <summary>Identifiant stable utilisé par l'API (kebab-case, sans accents).</summary>
    string Id { get; }

    string Name { get; }

    string Description { get; }

    PixelBuffer Apply(PixelBuffer source, DistortionSettings settings);
}

/// <param name="FocusX">Point focal horizontal, de 0 (gauche) à 1 (droite). Typiquement le nez.</param>
/// <param name="FocusY">Point focal vertical, de 0 (haut) à 1 (bas).</param>
/// <param name="Intensity">Force de la déformation, de 0 (rien) à 1 (n'importe quoi).</param>
public sealed record DistortionSettings(float FocusX = 0.5f, float FocusY = 0.4f, float Intensity = 0.7f)
{
    public DistortionSettings Normalized() => new(
        Math.Clamp(FocusX, 0f, 1f),
        Math.Clamp(FocusY, 0f, 1f),
        Math.Clamp(Intensity, 0f, 1f));
}
