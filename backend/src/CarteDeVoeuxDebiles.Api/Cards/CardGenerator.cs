using CarteDeVoeuxDebiles.Api.Storage;
using CarteDeVoeuxDebiles.Core.Distortions;
using CarteDeVoeuxDebiles.Core.Imaging;

namespace CarteDeVoeuxDebiles.Api.Cards;

public sealed record CreateUploadResponse(string UploadId, string UploadUrl, string ContentType);

public sealed record GenerateRequest(
    string UploadId,
    IReadOnlyList<string>? Effects,
    float FocusX = 0.5f,
    float FocusY = 0.4f,
    float Intensity = 0.7f);

public sealed record GeneratedImage(string EffectId, string Name, string Url);

public sealed record GenerateResponse(IReadOnlyList<GeneratedImage> Images);

public sealed record EffectDto(string Id, string Name, string Description);

public sealed class CardGenerator(IImageStore store, DistortionCatalog catalog, ILogger<CardGenerator> logger)
{
    /// <summary>Côté le plus long des images générées : suffisant pour un A5 à 300 dpi.</summary>
    public const int MaxSide = 2000;
    public const long MaxUploadBytes = 15 * 1024 * 1024;
    public const string UploadContentType = "image/jpeg";

    public static string UploadKey(Guid uploadId) => $"uploads/{uploadId:N}.jpg";

    public async Task<CreateUploadResponse> CreateUploadAsync(CancellationToken ct)
    {
        var uploadId = Guid.NewGuid();
        var url = await store.GetUploadUrlAsync(UploadKey(uploadId), UploadContentType, ct);
        return new CreateUploadResponse(uploadId.ToString("N"), url, UploadContentType);
    }

    public async Task<IResult> GenerateAsync(GenerateRequest request, CancellationToken ct)
    {
        if (!Guid.TryParseExact(request.UploadId, "N", out var uploadId))
            return Results.Problem("Identifiant d'upload invalide.", statusCode: StatusCodes.Status400BadRequest);

        var requested = request.Effects is { Count: > 0 } ? request.Effects : catalog.All.Select(d => d.Id).ToList();
        var distortions = new List<IDistortion>();
        foreach (var id in requested.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!catalog.TryGet(id, out var distortion))
                return Results.Problem($"Effet inconnu : {id}", statusCode: StatusCodes.Status400BadRequest);
            distortions.Add(distortion);
        }

        byte[]? original;
        try
        {
            original = await store.ReadAsync(UploadKey(uploadId), MaxUploadBytes, ct);
        }
        catch (ImageTooLargeException)
        {
            return Results.Problem("La photo dépasse 15 Mo.", statusCode: StatusCodes.Status413PayloadTooLarge);
        }
        if (original is null)
            return Results.Problem("Photo introuvable (expirée ?). Merci de la renvoyer.", statusCode: StatusCodes.Status404NotFound);

        PixelBuffer source;
        try
        {
            using var stream = new MemoryStream(original);
            source = ImageCodec.Decode(stream, MaxSide);
        }
        catch (InvalidImageException e)
        {
            return Results.Problem(e.Message, statusCode: StatusCodes.Status400BadRequest);
        }

        var settings = new DistortionSettings(request.FocusX, request.FocusY, request.Intensity).Normalized();
        logger.LogInformation("Génération de {Count} effets sur {Width}x{Height}", distortions.Count, source.Width, source.Height);

        // Les déformations sont déjà parallélisées par ligne : on les enchaîne, et seuls les envois au stockage se chevauchent.
        var uploads = new List<Task<GeneratedImage>>();
        foreach (var distortion in distortions)
        {
            var jpeg = ImageCodec.EncodeJpeg(distortion.Apply(source, settings));
            uploads.Add(StoreResultAsync(uploadId, distortion, jpeg, ct));
        }

        return Results.Ok(new GenerateResponse(await Task.WhenAll(uploads)));
    }

    private async Task<GeneratedImage> StoreResultAsync(Guid uploadId, IDistortion distortion, byte[] jpeg, CancellationToken ct)
    {
        // Suffixe aléatoire : régénérer avec d'autres réglages ne réutilise pas une image en cache.
        var key = $"results/{uploadId:N}/{distortion.Id}-{Guid.NewGuid():N}.jpg";
        await store.WriteAsync(key, jpeg, "image/jpeg", ct);
        return new GeneratedImage(distortion.Id, distortion.Name, await store.GetDownloadUrlAsync(key, ct));
    }
}
