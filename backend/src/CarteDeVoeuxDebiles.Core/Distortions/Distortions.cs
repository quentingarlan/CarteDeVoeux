using CarteDeVoeuxDebiles.Core.Imaging;

namespace CarteDeVoeuxDebiles.Core.Distortions;

/// <summary>
/// Base commune : calcule le point focal en pixels et délègue le calcul du mapping inverse.
/// </summary>
public abstract class WarpDistortion : IDistortion
{
    public abstract string Id { get; }
    public abstract string Name { get; }
    public abstract string Description { get; }

    public PixelBuffer Apply(PixelBuffer source, DistortionSettings settings)
    {
        var s = settings.Normalized();
        var context = new WarpContext(
            source.Width,
            source.Height,
            s.FocusX * (source.Width - 1),
            s.FocusY * (source.Height - 1),
            s.Intensity);
        return Warp.Apply(source, CreateMap(context));
    }

    protected abstract InverseMap CreateMap(WarpContext c);
}

public readonly record struct WarpContext(int Width, int Height, float CenterX, float CenterY, float Intensity)
{
    public float MinSide => Math.Min(Width, Height);
}

/// <summary>Fait tourner l'image autour du point focal, plus fort au centre.</summary>
public sealed class SwirlDistortion : WarpDistortion
{
    public override string Id => "tourbillon";
    public override string Name => "Tourbillon";
    public override string Description => "Le visage part dans la machine à laver.";

    protected override InverseMap CreateMap(WarpContext c)
    {
        var radius = c.MinSide * (0.35f + 0.35f * c.Intensity);
        var maxAngle = c.Intensity * 3f * MathF.PI;

        return (x, y) =>
        {
            var dx = x - c.CenterX;
            var dy = y - c.CenterY;
            var r = MathF.Sqrt(dx * dx + dy * dy);
            if (r >= radius)
                return (x, y);

            var t = 1f - r / radius;
            var (sin, cos) = MathF.SinCos(maxAngle * t * t);
            return (c.CenterX + dx * cos - dy * sin, c.CenterY + dx * sin + dy * cos);
        };
    }
}

/// <summary>
/// Déformation radiale : la distance au centre est élevée à une puissance.
/// Exposant &gt; 1 : effet loupe (grosse tête). Exposant &lt; 1 : effet pincé (tête de fourmi).
/// </summary>
public abstract class RadialDistortion : WarpDistortion
{
    protected abstract float RadiusFactor(float intensity);
    protected abstract float Exponent(float intensity);

    protected override InverseMap CreateMap(WarpContext c)
    {
        var radius = c.MinSide * RadiusFactor(c.Intensity);
        var exponent = Exponent(c.Intensity);

        return (x, y) =>
        {
            var dx = x - c.CenterX;
            var dy = y - c.CenterY;
            var r = MathF.Sqrt(dx * dx + dy * dy);
            if (r >= radius || r < 0.0001f)
                return (x, y);

            var scale = MathF.Pow(r / radius, exponent - 1f);
            return (c.CenterX + dx * scale, c.CenterY + dy * scale);
        };
    }
}

public sealed class BulgeDistortion : RadialDistortion
{
    public override string Id => "grosse-tete";
    public override string Name => "Grosse tête";
    public override string Description => "Effet loupe XXL sur le point choisi (idéal sur le nez).";
    protected override float RadiusFactor(float intensity) => 0.3f + 0.25f * intensity;
    protected override float Exponent(float intensity) => 1f + 1.4f * intensity;
}

public sealed class PinchDistortion : RadialDistortion
{
    public override string Id => "tete-de-fourmi";
    public override string Name => "Tête de fourmi";
    public override string Description => "Tout se ratatine vers le centre.";
    protected override float RadiusFactor(float intensity) => 0.35f + 0.25f * intensity;
    protected override float Exponent(float intensity) => 1f / (1f + 1.2f * intensity);
}

/// <summary>Ondulations sinusoïdales, comme vu à travers l'eau.</summary>
public sealed class WaveDistortion : WarpDistortion
{
    public override string Id => "mal-de-mer";
    public override string Name => "Mal de mer";
    public override string Description => "Ondulations garanties sans Mercalm.";

    protected override InverseMap CreateMap(WarpContext c)
    {
        var amplitude = c.MinSide * 0.045f * c.Intensity;
        var wavelengthX = c.Height * 0.22f;
        var wavelengthY = c.Width * 0.3f;

        return (x, y) => (
            x + amplitude * MathF.Sin(2f * MathF.PI * y / wavelengthX),
            y + amplitude * 0.6f * MathF.Sin(2f * MathF.PI * x / wavelengthY));
    }
}

/// <summary>
/// Étire l'image le long d'un axe autour du point focal avec un profil gaussien :
/// la zone centrale grossit, les bords restent en place.
/// </summary>
public abstract class AxisStretchDistortion : WarpDistortion
{
    private const float Sigma = 0.22f;

    protected abstract bool Vertical { get; }

    protected override InverseMap CreateMap(WarpContext c)
    {
        var length = Vertical ? c.Height : c.Width;
        var center = Vertical ? c.CenterY : c.CenterX;
        var strength = 0.65f * c.Intensity;

        float Remap(float v)
        {
            var n = (v - center) / length;
            var g = MathF.Exp(-(n * n) / (2f * Sigma * Sigma));
            return center + n * (1f - strength * g) * length;
        }

        return Vertical
            ? (x, y) => (x, Remap(y))
            : (x, y) => (Remap(x), y);
    }
}

public sealed class EggHeadDistortion : AxisStretchDistortion
{
    public override string Id => "tete-d-oeuf";
    public override string Name => "Tête d'œuf";
    public override string Description => "Étirement vertical façon miroir de fête foraine.";
    protected override bool Vertical => true;
}

public sealed class PancakeDistortion : AxisStretchDistortion
{
    public override string Id => "tete-de-crepe";
    public override string Name => "Tête de crêpe";
    public override string Description => "Étirement horizontal, spécial Chandeleur.";
    protected override bool Vertical => false;
}

/// <summary>Recopie la moitié gauche en miroir sur la droite, à partir du point focal.</summary>
public sealed class TwinsDistortion : WarpDistortion
{
    public override string Id => "jumeaux";
    public override string Name => "Jumeaux";
    public override string Description => "Symétrie parfaite… et parfaitement dérangeante.";

    protected override InverseMap CreateMap(WarpContext c) =>
        (x, y) => (x <= c.CenterX ? x : 2f * c.CenterX - x, y);
}

/// <summary>Miroir sur les deux axes autour du point focal : quatre fois la même tête.</summary>
public sealed class QuadrupletsDistortion : WarpDistortion
{
    public override string Id => "quadruples";
    public override string Name => "Quadruplés";
    public override string Description => "Kaléidoscope familial en 4 exemplaires.";

    protected override InverseMap CreateMap(WarpContext c) =>
        (x, y) => (
            x <= c.CenterX ? x : 2f * c.CenterX - x,
            y <= c.CenterY ? y : 2f * c.CenterY - y);
}

/// <summary>Fait couler l'image vers le bas, de plus en plus fort en descendant.</summary>
public sealed class MeltDistortion : WarpDistortion
{
    public override string Id => "fondu";
    public override string Name => "Fondu au soleil";
    public override string Description => "Comme un bonhomme de neige en août.";

    protected override InverseMap CreateMap(WarpContext c)
    {
        var maxDrip = c.Height * 0.3f * c.Intensity;
        var f1 = 2f * MathF.PI / (c.Width * 0.17f);
        var f2 = 2f * MathF.PI / (c.Width * 0.07f);

        return (x, y) =>
        {
            var drip = 0.55f + 0.3f * MathF.Sin(x * f1) + 0.15f * MathF.Sin(x * f2 + 1.3f);
            var progress = y / c.Height;
            return (x, y - maxDrip * drip * progress * progress);
        };
    }
}
