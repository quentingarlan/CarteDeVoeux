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
    builder.Services.AddSingleton<LocalImageStore>();
    builder.Services.AddSingleton<IImageStore>(sp => sp.GetRequiredService<LocalImageStore>());
}

builder.Services.AddSingleton(DistortionCatalog.Default);
builder.Services.AddScoped<CardGenerator>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();

var api = app.MapGroup("/api");

api.MapGet("/health", () => Results.Ok(new { status = "ok" }));

api.MapGet("/effects", (DistortionCatalog catalog) =>
    catalog.All.Select(d => new EffectDto(d.Id, d.Name, d.Description)));

api.MapPost("/uploads", (CardGenerator generator, CancellationToken ct) => generator.CreateUploadAsync(ct));

api.MapPost("/cards", (GenerateRequest request, CardGenerator generator, CancellationToken ct) =>
    generator.GenerateAsync(request, ct));

if (app.Services.GetService<LocalImageStore>() is { } localStore)
{
    // Émule les URLs présignées S3 pour le développement local.
    api.MapPut("/local-storage/{**key}", async (string key, HttpRequest request, CancellationToken ct) =>
    {
        using var memory = new MemoryStream();
        await request.Body.CopyToAsync(memory, ct);
        if (memory.Length > CardGenerator.MaxUploadBytes)
            return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
        await localStore.WriteAsync(key, memory.ToArray(), request.ContentType ?? "application/octet-stream", ct);
        return Results.Ok();
    });

    api.MapGet("/local-storage/{**key}", (string key) =>
    {
        var path = localStore.Resolve(key);
        return File.Exists(path) ? Results.File(path, "image/jpeg") : Results.NotFound();
    });
}

app.Run();
