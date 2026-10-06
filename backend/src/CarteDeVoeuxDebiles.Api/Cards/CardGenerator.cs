using CarteDeVoeuxDebiles.Api.Storage;
using CarteDeVoeuxDebiles.Core.Distortions;
using CarteDeVoeuxDebiles.Core.Imaging;

namespace CarteDeVoeuxDebiles.Api.Cards;

public sealed record CreateUploadResponse(string UploadId, string UploadUrl, IReadOnlyDictionary<string, string> UploadFields);

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
    public const int MaxGenerationsPerUpload = 20;

    public static string UploadKey(Guid uploadId) => $"uploads/{uploadId:N}.jpg";

    private static string ResultsPrefix(Guid uploadId) => $"results/{uploadId:N}/";

    public async Task<CreateUploadResponse> CreateUploadAsync(CancellationToken ct)
    {
        var uploadId = Guid.NewGuid();
        var upload = await store.CreateUploadAsync(UploadKey(uploadId), UploadContentType, MaxUploadBytes, ct);
        return new CreateUploadResponse(uploadId.ToString("N"), upload.Url, upload.Fields);
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

        // Chaque génération coûte plusieurs secondes de Lambda : on empêche de boucler indéfiniment sur la même photo.
        // Simple indication : c'est la réservation du créneau, plus bas, qui fait foi.
        var firstFreeSlot = await store.CountFoldersAsync(ResultsPrefix(uploadId), ct);
        if (firstFreeSlot >= MaxGenerationsPerUpload)
            return TooManyGenerations();

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
        // Un dossier par génération, numéroté : régénérer avec d'autres réglages ne réutilise pas une image en cache.
        if (await ClaimSlotAsync(uploadId, firstFreeSlot, ct) is not { } slot)
            return TooManyGenerations();
        var generationPrefix = $"{ResultsPrefix(uploadId)}{slot:D2}/";
        var uploads = new List<Task<GeneratedImage>>();
        foreach (var distortion in distortions)
        {
            var jpeg = ImageCodec.EncodeJpeg(distortion.Apply(source, settings));
            uploads.Add(StoreResultAsync(generationPrefix, distortion, jpeg, ct));
        }

        return Results.Ok(new GenerateResponse(await Task.WhenAll(uploads)));
    }

    /// <summary>
    /// Réserve atomiquement le premier créneau libre : des requêtes simultanées ne peuvent pas dépasser
    /// <see cref="MaxGenerationsPerUpload"/>, ce que le seul comptage des dossiers ne garantissait pas.
    /// </summary>
    private async Task<int?> ClaimSlotAsync(Guid uploadId, int firstFreeSlot, CancellationToken ct)
    {
        for (var slot = firstFreeSlot; slot < MaxGenerationsPerUpload; slot++)
        {
            if (await store.TryCreateAsync($"{ResultsPrefix(uploadId)}{slot:D2}/.claim", ct))
                return slot;
        }
        return null;
    }

    private static IResult TooManyGenerations() =>
        Results.Problem("Trop de versions pour cette photo : renvoyez-la pour continuer.", statusCode: StatusCodes.Status429TooManyRequests);

    private async Task<GeneratedImage> StoreResultAsync(string generationPrefix, IDistortion distortion, byte[] jpeg, CancellationToken ct)
    {
        var key = $"{generationPrefix}{distortion.Id}.jpg";
        await store.WriteAsync(key, jpeg, "image/jpeg", ct);
        return new GeneratedImage(distortion.Id, distortion.Name, await store.GetDownloadUrlAsync(key, ct));
    }
}
