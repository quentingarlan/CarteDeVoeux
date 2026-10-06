using CarteDeVoeuxDebiles.Core.Distortions;
using CarteDeVoeuxDebiles.Core.Imaging;

namespace CarteDeVoeuxDebiles.Core.Tests;

public class DistortionTests
{
    public static TheoryData<string> AllEffects()
    {
        var data = new TheoryData<string>();
        foreach (var d in DistortionCatalog.Default.All.Where(d => d is not NoDistortion))
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
    public void No_filter_leaves_the_image_untouched_even_at_full_intensity()
    {
        var source = Gradient();

        var result = new NoDistortion().Apply(source, new DistortionSettings(0.3f, 0.6f, 1f));

        Assert.Equal(source.Pixels, result.Pixels);
    }

    [Fact]
    public void No_filter_comes_first_in_the_catalog() =>
        Assert.IsType<NoDistortion>(DistortionCatalog.Default.All[0]);

    [Fact]
    public void Extreme_stretches_the_face_to_every_edge_of_the_frame()
    {
        var source = Gradient(201, 201);

        var result = new ExtremeDistortion().Apply(source, new DistortionSettings(0.5f, 0.5f, 0.5f));

        // Intensité 0,5 : demi-visage de 201 × 0,23 ≈ 46 px de large, 60 px de haut.
        // Les bords du cadre affichent le contour du visage, le centre reste sur le nez.
        var redAt = (uint p) => (int)(p & 0xFF);
        var greenAt = (uint p) => (int)((p >> 8) & 0xFF);
        Assert.Equal(source[100, 100], result[100, 100]);
        Assert.InRange(redAt(result[0, 100]), redAt(source[52, 100]), redAt(source[56, 100]));
        Assert.InRange(redAt(result[200, 100]), redAt(source[144, 100]), redAt(source[148, 100]));
        Assert.InRange(greenAt(result[100, 0]), greenAt(source[100, 38]), greenAt(source[100, 42]));
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
