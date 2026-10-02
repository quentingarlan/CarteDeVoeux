using CarteDeVoeuxDebiles.Core.Imaging;

namespace CarteDeVoeuxDebiles.Core.Tests;

public class ImagingTests
{
    private static readonly uint Red = PixelBuffer.Pack(255, 0, 0);
    private static readonly uint Blue = PixelBuffer.Pack(0, 0, 255);

    [Theory]
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(7)]
    [InlineData(8)]
    public void Exif_rotation_swaps_dimensions(int orientation)
    {
        var source = new PixelBuffer(3, 2);

        var result = Orientation.ApplyExif(source, orientation);

        Assert.Equal(2, result.Width);
        Assert.Equal(3, result.Height);
    }

    [Fact]
    public void Exif_6_rotates_clockwise()
    {
        var source = new PixelBuffer(3, 2);
        source[0, 0] = Red;

        var result = Orientation.ApplyExif(source, 6);

        Assert.Equal(Red, result[1, 0]);
    }

    [Fact]
    public void Exif_1_returns_the_same_buffer()
    {
        var source = new PixelBuffer(3, 2);
        Assert.Same(source, Orientation.ApplyExif(source, 1));
    }

    [Fact]
    public void Bilinear_sampling_interpolates_between_pixels()
    {
        var source = new PixelBuffer(2, 1, [Red, Blue]);

        var middle = Warp.SampleBilinear(source, 0.5f, 0f);

        Assert.InRange(middle & 0xFF, 127u, 128u);
        Assert.InRange((middle >> 16) & 0xFF, 127u, 128u);
    }

    [Fact]
    public void Jpeg_round_trip_preserves_dimensions_and_downscales()
    {
        var source = new PixelBuffer(400, 300);
        Array.Fill(source.Pixels, Red);

        var jpeg = ImageCodec.EncodeJpeg(source);
        using var stream = new MemoryStream(jpeg);
        var decoded = ImageCodec.Decode(stream, maxSide: 200);

        Assert.Equal(200, decoded.Width);
        Assert.Equal(150, decoded.Height);
        Assert.InRange(decoded[100, 75] & 0xFF, 240u, 255u);
    }

    [Fact]
    public void Decoding_garbage_throws_invalid_image()
    {
        using var stream = new MemoryStream("pas une image"u8.ToArray());
        Assert.Throws<InvalidImageException>(() => ImageCodec.Decode(stream, 100));
    }
}
