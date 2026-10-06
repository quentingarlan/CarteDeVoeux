namespace CarteDeVoeuxDebiles.Api.Storage;

/// <summary>Formulaire que le navigateur envoie directement au stockage (POST multipart, fichier en dernier).</summary>
public sealed record PresignedUpload(string Url, IReadOnlyDictionary<string, string> Fields);

public interface IImageStore
{
    /// <summary>
    /// Formulaire signé pour envoyer la photo. Contrairement à une URL PUT présignée, la politique POST
    /// fait refuser par le stockage lui-même tout fichier de plus de <paramref name="maxBytes"/>.
    /// </summary>
    Task<PresignedUpload> CreateUploadAsync(string key, string contentType, long maxBytes, CancellationToken ct);

    /// <summary>Nombre de « sous-dossiers » directs sous <paramref name="prefix"/> (qui doit finir par « / »).</summary>
    Task<int> CountFoldersAsync(string prefix, CancellationToken ct);

    /// <summary>
    /// Crée un objet vide s'il n'existe pas encore, de façon atomique : <c>false</c> s'il existait déjà.
    /// Sert de verrou, deux requêtes simultanées ne peuvent pas réserver la même clé.
    /// </summary>
    Task<bool> TryCreateAsync(string key, CancellationToken ct);

    /// <summary>Retourne le contenu de l'objet, ou <c>null</c> s'il n'existe pas.</summary>
    Task<byte[]?> ReadAsync(string key, long maxBytes, CancellationToken ct);

    Task WriteAsync(string key, byte[] content, string contentType, CancellationToken ct);

    Task<string> GetDownloadUrlAsync(string key, CancellationToken ct);
}

public sealed class StorageOptions
{
    public const string Section = "Storage";

    /// <summary><c>S3</c> en production, <c>Local</c> pour développer sans compte AWS.</summary>
    public string Mode { get; set; } = "Local";

    public string? BucketName { get; set; }

    public string LocalPath { get; set; } = ".local-storage";

    public TimeSpan UrlLifetime { get; set; } = TimeSpan.FromHours(1);
}

public sealed class ImageTooLargeException() : Exception("Image trop volumineuse.");
