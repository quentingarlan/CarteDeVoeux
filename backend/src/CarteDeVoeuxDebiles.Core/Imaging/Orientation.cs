namespace CarteDeVoeuxDebiles.Core.Imaging;

public static class Orientation
{
    /// <summary>
    /// Remet l'image « à l'endroit » selon le tag EXIF Orientation (1 à 8) écrit par les smartphones.
    /// </summary>
    public static PixelBuffer ApplyExif(PixelBuffer source, int exifOrientation)
    {
        if (exifOrientation is < 2 or > 8)
            return source;

        var w = source.Width;
        var h = source.Height;
        var swapsAxes = exifOrientation >= 5;
        var result = swapsAxes ? new PixelBuffer(h, w) : new PixelBuffer(w, h);

        for (var y = 0; y < h; y++)
        for (var x = 0; x < w; x++)
        {
            var (dx, dy) = exifOrientation switch
            {
                2 => (w - 1 - x, y),          // miroir horizontal
                3 => (w - 1 - x, h - 1 - y),  // rotation 180°
                4 => (x, h - 1 - y),          // miroir vertical
                5 => (y, x),                  // transposition
                6 => (h - 1 - y, x),          // rotation 90° horaire
                7 => (h - 1 - y, w - 1 - x),  // transversale
                _ => (y, w - 1 - x),          // 8 : rotation 90° anti-horaire
            };
            result[dx, dy] = source[x, y];
        }

        return result;
    }
}
