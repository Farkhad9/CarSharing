using CarSharing.Application.Common.Interfaces;

namespace CarSharing.WebApi.Services;

public class LocalVehicleImageStorage : IVehicleImageStorage
{
    private static readonly Dictionary<string, string> ExtensionByContentType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/jpg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp"
    };

    private readonly IWebHostEnvironment _environment;

    public LocalVehicleImageStorage(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    public async Task<string> SaveAsync(
        string slot,
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken = default)
    {
        var webRootPath = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRootPath))
        {
            webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        var uploadDirectory = Path.Combine(webRootPath, "uploads", "vehicles");
        Directory.CreateDirectory(uploadDirectory);

        var extension = ExtensionByContentType.TryGetValue(contentType, out var knownExtension)
            ? knownExtension
            : Path.GetExtension(fileName);

        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ".jpg";
        }

        var safeSlot = string.IsNullOrWhiteSpace(slot) ? "vehicle" : slot.Trim().ToLowerInvariant();
        var safeFileName = $"{safeSlot}-{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadDirectory, safeFileName);

        await using (var output = File.Create(filePath))
        {
            await content.CopyToAsync(output, cancellationToken);
        }

        return $"/uploads/vehicles/{safeFileName}";
    }
}
