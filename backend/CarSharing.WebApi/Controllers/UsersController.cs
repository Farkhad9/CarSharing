using CarSharing.Application.Common.Models;
using CarSharing.Application.Users.Dtos;
using CarSharing.Application.Users.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController : ControllerBase
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png"
    };

    private readonly IUserService _userService;
    private readonly IWebHostEnvironment _environment;

    public UsersController(IUserService userService, IWebHostEnvironment environment)
    {
        _userService = userService;
        _environment = environment;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe(CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { errors = new[] { new Error("User.Unauthenticated", "User must be authenticated.") } });
        }

        var result = await _userService.GetByIdAsync(userId, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost("me/identity-documents")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<IActionResult> SubmitIdentityDocuments(
        [FromForm] IFormFile driverLicense,
        [FromForm] IFormFile passport,
        CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { errors = new[] { new Error("User.Unauthenticated", "User must be authenticated.") } });
        }

        var validationError = ValidateDocument(driverLicense, "driver license") ?? ValidateDocument(passport, "passport");
        if (validationError is not null)
        {
            return BadRequest(new { errors = new[] { validationError } });
        }

        var driverLicenseUrl = await SaveDocumentAsync(userId, "driver-license", driverLicense, cancellationToken);
        var passportUrl = await SaveDocumentAsync(userId, "passport", passport, cancellationToken);
        var result = await _userService.SubmitVerificationDocumentsAsync(userId, driverLicenseUrl, passportUrl, cancellationToken);

        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        return Guid.TryParse(value, out userId);
    }

    private static Error? ValidateDocument(IFormFile? file, string label)
    {
        if (file is null || file.Length == 0)
        {
            return new Error("Validation.IdentityDocument", $"Upload your {label} document.");
        }

        if (file.Length > 10 * 1024 * 1024)
        {
            return new Error("Validation.IdentityDocument", $"{label} photo exceeds 10 MB. Please upload a smaller photo.");
        }

        var extension = Path.GetExtension(file.FileName);
        var hasJpegExtension = extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase)
            || extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase);
        var hasPngExtension = extension.Equals(".png", StringComparison.OrdinalIgnoreCase);

        return AllowedContentTypes.Contains(file.ContentType) && (hasJpegExtension || hasPngExtension)
            ? null
            : new Error("Validation.IdentityDocument", $"Upload a photo in JPEG or PNG format for your {label}. PDF files are not accepted.");
    }

    private async Task<string> SaveDocumentAsync(Guid userId, string type, IFormFile file, CancellationToken cancellationToken)
    {
        var webRootPath = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRootPath))
        {
            webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        var uploadDirectory = Path.Combine(webRootPath, "uploads", "identity", userId.ToString("N"));
        Directory.CreateDirectory(uploadDirectory);

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ".jpg";
        }

        var fileName = $"{type}-{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadDirectory, fileName);

        await using (var output = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(output, cancellationToken);
        }

        return $"{Request.Scheme}://{Request.Host}/uploads/identity/{userId:N}/{fileName}";
    }

    private static IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code == "User.NotFound"))
        {
            return new NotFoundObjectResult(new { errors });
        }

        return new BadRequestObjectResult(new { errors });
    }
}
