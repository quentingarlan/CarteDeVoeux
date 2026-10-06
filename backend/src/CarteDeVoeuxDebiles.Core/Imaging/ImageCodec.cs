using System.Runtime.InteropServices;
using SkiaSharp;

namespace CarteDeVoeuxDebiles.Core.Imaging;

/// <summary>
/// Décodage / encodage via SkiaSharp. Tout le reste (déformations, orientation) est en C# pur.
/// </summary>
public static class ImageCodec
{
    /// <summary>
    /// Vérifié sur l'en-tête, avant décodage : quelques Ko suffisent à annoncer 50 000 × 50 000 px (10 Go en mémoire).
    /// Le site envoie au plus 2400 px de côté, 40 Mpx laisse une large marge.
    /// </summary>
    public const long MaxDecodedPixels = 40_000_000;

    public static PixelBuffer Decode(Stream stream, int maxSide)
    {
        using var codec = SKCodec.Create(stream)
            ?? throw new InvalidImageException("Format d'image non reconnu.");
        if ((long)codec.Info.Width * codec.Info.Height > MaxDecodedPixels)
            throw new InvalidImageException("Image trop grande.");

        var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        using var decoded = SKBitmap.Decode(codec, info)
            ?? throw new InvalidImageException("Impossible de décoder l'image.");

        using var resized = ResizeToFit(decoded, maxSide);
        var buffer = ToPixelBuffer(resized ?? decoded);
        return Orientation.ApplyExif(buffer, (int)codec.EncodedOrigin);
    }

    public static byte[] EncodeJpeg(PixelBuffer buffer, int quality = 90)
    {
        var info = new SKImageInfo(buffer.Width, buffer.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        using var bitmap = new SKBitmap(info);
        CopyToBitmap(buffer, bitmap);

        using var data = bitmap.Encode(SKEncodedImageFormat.Jpeg, quality)
            ?? throw new InvalidOperationException("Échec de l'encodage JPEG.");
        return data.ToArray();
    }

    private static SKBitmap? ResizeToFit(SKBitmap bitmap, int maxSide)
    {
        var largest = Math.Max(bitmap.Width, bitmap.Height);
        if (largest <= maxSide)
            return null;

        var ratio = (float)maxSide / largest;
        var info = new SKImageInfo(
            Math.Max(1, (int)MathF.Round(bitmap.Width * ratio)),
            Math.Max(1, (int)MathF.Round(bitmap.Height * ratio)),
            SKColorType.Rgba8888,
            SKAlphaType.Unpremul);
        return bitmap.Resize(info, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear))
            ?? throw new InvalidOperationException("Échec du redimensionnement.");
    }

    private static PixelBuffer ToPixelBuffer(SKBitmap bitmap)
    {
        var buffer = new PixelBuffer(bitmap.Width, bitmap.Height);
        var destination = MemoryMarshal.AsBytes(buffer.Pixels.AsSpan());
        var source = bitmap.GetPixels();
        var rowBytes = bitmap.Width * 4;
        var row = new byte[rowBytes];

        for (var y = 0; y < bitmap.Height; y++)
        {
            Marshal.Copy(source + y * bitmap.RowBytes, row, 0, rowBytes);
            row.CopyTo(destination.Slice(y * rowBytes, rowBytes));
        }

        return buffer;
    }

    private static void CopyToBitmap(PixelBuffer buffer, SKBitmap bitmap)
    {
        var source = MemoryMarshal.AsBytes(buffer.Pixels.AsSpan());
        var destination = bitmap.GetPixels();
        var rowBytes = buffer.Width * 4;
        var row = new byte[rowBytes];

        for (var y = 0; y < buffer.Height; y++)
        {
            source.Slice(y * rowBytes, rowBytes).CopyTo(row);
            Marshal.Copy(row, 0, destination + y * bitmap.RowBytes, rowBytes);
        }
    }
}

public sealed class InvalidImageException(string message) : Exception(message);
