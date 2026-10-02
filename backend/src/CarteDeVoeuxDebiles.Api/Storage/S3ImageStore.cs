using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace CarteDeVoeuxDebiles.Api.Storage;

public sealed class S3ImageStore(IAmazonS3 s3, IOptions<StorageOptions> options) : IImageStore
{
    private readonly StorageOptions _options = options.Value;

    private string Bucket => _options.BucketName
        ?? throw new InvalidOperationException("Storage:BucketName n'est pas configuré.");

    public Task<string> GetUploadUrlAsync(string key, string contentType, CancellationToken ct) =>
        s3.GetPreSignedURLAsync(new GetPreSignedUrlRequest
        {
            BucketName = Bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            ContentType = contentType,
            Expires = DateTime.UtcNow.AddMinutes(10),
        });

    public async Task<byte[]?> ReadAsync(string key, long maxBytes, CancellationToken ct)
    {
        try
        {
            using var response = await s3.GetObjectAsync(Bucket, key, ct);
            if (response.ContentLength > maxBytes)
                throw new ImageTooLargeException();

            using var memory = new MemoryStream((int)response.ContentLength);
            await response.ResponseStream.CopyToAsync(memory, ct);
            return memory.ToArray();
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task WriteAsync(string key, byte[] content, string contentType, CancellationToken ct)
    {
        using var stream = new MemoryStream(content);
        await s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = Bucket,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
        }, ct);
    }

    public Task<string> GetDownloadUrlAsync(string key, CancellationToken ct) =>
        s3.GetPreSignedURLAsync(new GetPreSignedUrlRequest
        {
            BucketName = Bucket,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.Add(_options.UrlLifetime),
        });
}
