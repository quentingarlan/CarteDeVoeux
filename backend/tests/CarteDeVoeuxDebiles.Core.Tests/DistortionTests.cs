using CarteDeVoeuxDebiles.Core.Distortions;
using CarteDeVoeuxDebiles.Core.Imaging;

namespace CarteDeVoeuxDebiles.Core.Tests;

public class DistortionTests
{
    public static TheoryData<string> AllEffects()
    {
        var data = new TheoryData<string>();
        foreach (var d in DistortionCatalog.Default.All)
            data.Add(d.Id);
        return data;
    }

    /// <summary>Dégradé : rouge = x, vert = y, pour savoir d'où vient chaque pixel.</summary>
    private static PixelBuffer Gradient(int width = 120, int height = 80)
    {
        var buffer = new PixelBuffer(width, height);
        for (var y = 0; y < height; y++)
        for (var x = 0; x < width; x++)
            buffer[x, y] = PixelBuffer.Pack((byte)(x * 255 / (width - 1)), (byte)(y * 255 / (height - 1)), 128);
        return buffer;
    }

    [Theory]
    [MemberData(nameof(AllEffects))]
    public void Apply_keeps_dimensions_and_alters_the_image(string effectId)
    {
        Assert.True(DistortionCatalog.Default.TryGet(effectId, out var distortion));
        var source = Gradient();

        var result = distortion.Apply(source, new DistortionSettings(0.5f, 0.5f, 1f));

        Assert.Equal(source.Width, result.Width);
        Assert.Equal(source.Height, result.Height);
        Assert.NotEqual(source.Pixels, result.Pixels);
    }

    [Theory]
    [InlineData("grosse-tete")]
    [InlineData("tete-de-fourmi")]
    [InlineData("tourbillon")]
    [InlineData("tete-d-oeuf")]
    [InlineData("tete-de-crepe")]
    [InlineData("mal-de-mer")]
    [InlineData("fondu")]
    public void Zero_intensity_leaves_the_image_untouched(string effectId)
    {
        Assert.True(DistortionCatalog.Default.TryGet(effectId, out var distortion));
        var source = Gradient();

        var result = distortion.Apply(source, new DistortionSettings(0.3f, 0.6f, 0f));

        Assert.Equal(source.Pixels, result.Pixels);
    }

    [Fact]
    public void Twins_mirrors_left_half_onto_right_half()
    {
        var source = Gradient(101, 10);

        var result = new TwinsDistortion().Apply(source, new DistortionSettings(0.5f, 0.5f));

        for (var x = 0; x <= 50; x++)
            Assert.Equal(result[x, 5], result[100 - x, 5]);
    }

    [Fact]
    public void Bulge_magnifies_around_the_focus_point()
    {
        var source = Gradient(201, 201);
        var settings = new DistortionSettings(0.5f, 0.5f, 1f);

        var result = new BulgeDistortion().Apply(source, settings);

        // À 20 px du centre, la grosse tête affiche un pixel source plus proche du centre (zoom).
        var redAt = (uint p) => (int)(p & 0xFF);
        Assert.True(redAt(result[120, 100]) < redAt(source[120, 100]));
        Assert.True(redAt(result[120, 100]) > redAt(source[100, 100]));
    }

    [Fact]
    public void Out_of_range_settings_are_clamped()
    {
        var source = Gradient();

        var result = new SwirlDistortion().Apply(source, new DistortionSettings(-3f, 42f, 9f));

        Assert.Equal(source.Width, result.Width);
    }

    [Fact]
    public void Catalog_ids_are_unique_and_url_safe()
    {
        var ids = DistortionCatalog.Default.All.Select(d => d.Id).ToList();

        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.All(ids, id => Assert.Matches("^[a-z0-9-]+$", id));
    }
}
