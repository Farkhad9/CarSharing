using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Enums;

namespace CarSharing.WebApi.Services;

public class LocalTripPhotoStorage : ITripPhotoStorage
{
    private static readonly Dictionary<string, string> ExtensionByContentType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/jpg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp"
    };

    private readonly IWebHostEnvironment _environment;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public LocalTripPhotoStorage(
        IWebHostEnvironment environment,
        IHttpContextAccessor httpContextAccessor)
    {
        _environment = environment;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<string> SaveAsync(
        Guid tripId,
        Guid completionRequestId,
        TripPhotoAngle angle,
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

        var uploadDirectory = Path.Combine(
            webRootPath,
            "uploads",
            "trip-completions",
            tripId.ToString("N"),
            completionRequestId.ToString("N"));

        Directory.CreateDirectory(uploadDirectory);

        var extension = ExtensionByContentType.TryGetValue(contentType, out var knownExtension)
            ? knownExtension
            : Path.GetExtension(fileName);

        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ".jpg";
        }

        var safeFileName = $"{angle.ToString().ToLowerInvariant()}-{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadDirectory, safeFileName);

        await using (var output = File.Create(filePath))
        {
            await content.CopyToAsync(output, cancellationToken);
        }

        var relativeUrl = $"/uploads/trip-completions/{tripId:N}/{completionRequestId:N}/{safeFileName}";
        var request = _httpContextAccessor.HttpContext?.Request;

        return request is null
            ? relativeUrl
            : $"{request.Scheme}://{request.Host}{relativeUrl}";
    }
}
