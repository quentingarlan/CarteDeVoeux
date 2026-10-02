using Microsoft.Extensions.Options;

namespace CarteDeVoeuxDebiles.Api.Storage;

/// <summary>
/// Stockage sur disque pour le développement local. Les URLs pointent vers
/// les endpoints <c>/api/local-storage/*</c> exposés par l'API elle-même.
/// </summary>
public sealed class LocalImageStore(IOptions<StorageOptions> options) : IImageStore
{
    public const string RoutePrefix = "/api/local-storage";

    private readonly string _root = Path.GetFullPath(options.Value.LocalPath);

    public Task<string> GetUploadUrlAsync(string key, string contentType, CancellationToken ct) =>
        Task.FromResult($"{RoutePrefix}/{key}");

    public async Task<byte[]?> ReadAsync(string key, long maxBytes, CancellationToken ct)
    {
        var file = new FileInfo(Resolve(key));
        if (!file.Exists)
            return null;
        if (file.Length > maxBytes)
            throw new ImageTooLargeException();
        return await File.ReadAllBytesAsync(file.FullName, ct);
    }

    public async Task WriteAsync(string key, byte[] content, string contentType, CancellationToken ct)
    {
        var path = Resolve(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllBytesAsync(path, content, ct);
    }

    public Task<string> GetDownloadUrlAsync(string key, CancellationToken ct) =>
        Task.FromResult($"{RoutePrefix}/{key}");

    /// <summary>Résout la clé sous la racine en refusant toute sortie du dossier (« ../ »).</summary>
    public string Resolve(string key)
    {
        var path = Path.GetFullPath(Path.Combine(_root, key));
        if (!path.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Clé de stockage invalide.", nameof(key));
        return path;
    }
}
