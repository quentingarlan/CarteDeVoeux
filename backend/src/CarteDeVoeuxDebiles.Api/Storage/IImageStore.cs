namespace CarteDeVoeuxDebiles.Api.Storage;

public interface IImageStore
{
    /// <summary>URL sur laquelle le navigateur envoie directement la photo (HTTP PUT).</summary>
    Task<string> GetUploadUrlAsync(string key, string contentType, CancellationToken ct);

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
