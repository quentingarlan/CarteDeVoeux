using System.Security.Cryptography;
using System.Text;
using Amazon.S3;
using CarteDeVoeuxDebiles.Api.Cards;
using CarteDeVoeuxDebiles.Api.Storage;
using CarteDeVoeuxDebiles.Core.Distortions;

var builder = WebApplication.CreateBuilder(args);

// Sans effet en local : n'intervient que lorsque le process tourne dans AWS Lambda.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection(StorageOptions.Section));
var storageMode = builder.Configuration[$"{StorageOptions.Section}:Mode"] ?? "Local";
if (storageMode.Equals("S3", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client());
    builder.Services.AddSingleton<IImageStore, S3ImageStore>();
}
else
{
    // Les endpoints /api/local-storage n'ont aucune authentification : jamais ailleurs que sur le poste du développeur.
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Storage:Mode=Local est réservé à l'environnement Development.");
    builder.Services.AddSingleton<LocalImageStore>();
    builder.Services.AddSingleton<IImageStore>(sp => sp.GetRequiredService<LocalImageStore>());
}

builder.Services.AddSingleton(DistortionCatalog.Default);
builder.Services.AddScoped<CardGenerator>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();

// En production, seul CloudFront (donc le WAF) doit pouvoir appeler l'API : il ajoute cet en-tête secret,
// et les appels directs à l'URL execute-api sont refusés avant tout traitement.
if (app.Configuration["OriginVerify:Secret"] is { Length: > 0 } originSecret)
{
    var expected = Encoding.UTF8.GetBytes(originSecret);
    app.Use(async (context, next) =>
    {
        var received = Encoding.UTF8.GetBytes(context.Request.Headers[OriginVerify.Header].ToString());
        if (!CryptographicOperations.FixedTimeEquals(received, expected))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
        await next(context);
    });
}

var api = app.MapGroup("/api");

api.MapGet("/health", () => Results.Ok(new { status = "ok" }));

api.MapGet("/effects", (DistortionCatalog catalog) =>
    catalog.All.Select(d => new EffectDto(d.Id, d.Name, d.Description)));

api.MapPost("/uploads", (CardGenerator generator, CancellationToken ct) => generator.CreateUploadAsync(ct));

api.MapPost("/cards", (GenerateRequest request, CardGenerator generator, CancellationToken ct) =>
    generator.GenerateAsync(request, ct));

if (app.Services.GetService<LocalImageStore>() is { } localStore)
{
    // Émule le POST présigné S3 pour le développement local, avec les mêmes restrictions : une photo JPEG sous uploads/.
    api.MapPost("/local-storage/{**key}", async (string key, HttpRequest request, CancellationToken ct) =>
    {
        if (!key.StartsWith("uploads/", StringComparison.Ordinal))
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        var form = await request.ReadFormAsync(ct);
        if (form.Files.GetFile("file") is not { } file || form["Content-Type"] != CardGenerator.UploadContentType)
            return Results.BadRequest();
        if (file.Length > CardGenerator.MaxUploadBytes)
            return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
        using var memory = new MemoryStream();
        await file.CopyToAsync(memory, ct);
        await localStore.WriteAsync(key, memory.ToArray(), CardGenerator.UploadContentType, ct);
        return Results.NoContent();
    });

    api.MapGet("/local-storage/{**key}", (string key) =>
    {
        var path = localStore.Resolve(key);
        return File.Exists(path) ? Results.File(path, "image/jpeg") : Results.NotFound();
    });
}

app.Run();

static class OriginVerify
{
    public const string Header = "X-Origin-Verify";
}
