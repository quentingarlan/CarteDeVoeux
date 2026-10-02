namespace CarteDeVoeuxDebiles.Core.Imaging;

/// <summary>
/// Fonction qui, pour un pixel de l'image de sortie, donne la coordonnée à lire dans l'image source.
/// </summary>
public delegate (float X, float Y) InverseMap(float x, float y);

public static class Warp
{
    /// <summary>
    /// Déforme l'image par « mapping inverse » : chaque pixel de sortie va chercher sa couleur
    /// dans la source avec un échantillonnage bilinéaire, ce qui évite les trous.
    /// </summary>
    public static PixelBuffer Apply(PixelBuffer source, InverseMap map)
    {
        var result = new PixelBuffer(source.Width, source.Height);

        Parallel.For(0, source.Height, y =>
        {
            var row = y * source.Width;
            for (var x = 0; x < source.Width; x++)
            {
                var (sx, sy) = map(x, y);
                result.Pixels[row + x] = SampleBilinear(source, sx, sy);
            }
        });

        return result;
    }

    public static uint SampleBilinear(PixelBuffer source, float x, float y)
    {
        var maxX = source.Width - 1;
        var maxY = source.Height - 1;
        if (float.IsNaN(x)) x = 0;
        if (float.IsNaN(y)) y = 0;
        x = Math.Clamp(x, 0, maxX);
        y = Math.Clamp(y, 0, maxY);

        var x0 = (int)x;
        var y0 = (int)y;
        var x1 = Math.Min(x0 + 1, maxX);
        var y1 = Math.Min(y0 + 1, maxY);
        var fx = x - x0;
        var fy = y - y0;

        var p00 = source[x0, y0];
        var p10 = source[x1, y0];
        var p01 = source[x0, y1];
        var p11 = source[x1, y1];

        uint result = 0;
        for (var shift = 0; shift < 32; shift += 8)
        {
            float c00 = (p00 >> shift) & 0xFF;
            float c10 = (p10 >> shift) & 0xFF;
            float c01 = (p01 >> shift) & 0xFF;
            float c11 = (p11 >> shift) & 0xFF;

            var top = c00 + (c10 - c00) * fx;
            var bottom = c01 + (c11 - c01) * fx;
            var value = (uint)Math.Clamp(MathF.Round(top + (bottom - top) * fy), 0, 255);
            result |= value << shift;
        }

        return result;
    }
}
