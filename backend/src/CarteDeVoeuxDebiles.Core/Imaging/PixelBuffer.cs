namespace CarteDeVoeuxDebiles.Core.Imaging;

/// <summary>
/// Image RGBA 8 bits en mémoire, un <see cref="uint"/> par pixel (octets R, G, B, A en little-endian).
/// </summary>
public sealed class PixelBuffer
{
    public PixelBuffer(int width, int height, uint[]? pixels = null)
    {
        if (width <= 0 || height <= 0)
            throw new ArgumentOutOfRangeException(nameof(width), "Les dimensions doivent être strictement positives.");
        if (pixels is not null && pixels.Length != width * height)
            throw new ArgumentException("Le nombre de pixels ne correspond pas aux dimensions.", nameof(pixels));

        Width = width;
        Height = height;
        Pixels = pixels ?? new uint[width * height];
    }

    public int Width { get; }
    public int Height { get; }
    public uint[] Pixels { get; }

    public uint this[int x, int y]
    {
        get => Pixels[y * Width + x];
        set => Pixels[y * Width + x] = value;
    }

    public static uint Pack(byte r, byte g, byte b, byte a = 255) =>
        (uint)(r | (g << 8) | (b << 16) | (a << 24));
}
