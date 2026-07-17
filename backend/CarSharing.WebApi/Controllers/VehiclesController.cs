using CarSharing.Application.Common.Models;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Application.Vehicles.Services;
using CarSharing.WebApi.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/vehicles")]
public class VehiclesController : ControllerBase
{
    private const long MaxVehicleImageSizeBytes = 10 * 1024 * 1024;
    private static readonly HashSet<string> AllowedVehicleImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    };

    private readonly IVehicleService _vehicleService;
    private readonly IVehicleImageStorage _vehicleImageStorage;

    public VehiclesController(
        IVehicleService vehicleService,
        IVehicleImageStorage vehicleImageStorage)
    {
        _vehicleService = vehicleService;
        _vehicleImageStorage = vehicleImageStorage;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var result = await _vehicleService.GetAllAsync(cancellationToken);

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _vehicleService.GetByIdAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> Create(
        CreateVehicleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vehicleService.CreateAsync(request, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateVehicleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vehicleService.UpdateAsync(id, request, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/photos")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadPhotos(
        Guid id,
        [FromForm] VehiclePhotoUploadRequest request,
        CancellationToken cancellationToken)
    {
        var existingVehicle = await _vehicleService.GetByIdAsync(id, cancellationToken);
        if (existingVehicle.IsFailure)
        {
            return ToErrorResponse(existingVehicle.Errors);
        }

        var imageUrls = await SaveVehicleImagesAsync(request, cancellationToken);
        if (imageUrls.IsFailure)
        {
            return ToErrorResponse(imageUrls.Errors);
        }

        var result = await _vehicleService.UpdateImagesAsync(
            id,
            new UpdateVehicleImagesRequest
            {
                MainImageUrl = imageUrls.Value!.MainImageUrl,
                GalleryImageUrl1 = imageUrls.Value.GalleryImageUrl1,
                GalleryImageUrl2 = imageUrls.Value.GalleryImageUrl2,
                GalleryImageUrl3 = imageUrls.Value.GalleryImageUrl3
            },
            cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        UpdateVehicleStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vehicleService.UpdateStatusAsync(id, request, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code.StartsWith("Validation.")))
        {
            return BadRequest(new { errors });
        }

        if (errors.Any(error => error.Code == "Vehicle.NotFound"))
        {
            return NotFound(new { errors });
        }

        if (errors.Any(error => error.Code == "Vehicle.PlateNumberNotUnique"))
        {
            return Conflict(new { errors });
        }

        return BadRequest(new { errors });
    }

    private async Task<Result<VehicleImageUrls>> SaveVehicleImagesAsync(
        VehiclePhotoUploadRequest request,
        CancellationToken cancellationToken)
    {
        var errors = ValidateVehicleImageFiles(request);
        if (errors.Count > 0)
        {
            return Result<VehicleImageUrls>.Failure(errors);
        }

        return Result<VehicleImageUrls>.Success(new VehicleImageUrls(
            await SaveVehicleImageAsync("main", request.MainImage, cancellationToken),
            await SaveVehicleImageAsync("gallery-1", request.GalleryImage1, cancellationToken),
            await SaveVehicleImageAsync("gallery-2", request.GalleryImage2, cancellationToken),
            await SaveVehicleImageAsync("gallery-3", request.GalleryImage3, cancellationToken)));
    }

    private async Task<string?> SaveVehicleImageAsync(
        string slot,
        IFormFile? file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return null;
        }

        await using var content = file.OpenReadStream();
        return await _vehicleImageStorage.SaveAsync(
            slot,
            file.FileName,
            file.ContentType,
            content,
            cancellationToken);
    }

    private static IReadOnlyList<Error> ValidateVehicleImageFiles(VehiclePhotoUploadRequest request)
    {
        var files = new[]
            {
                (Name: "MainImage", File: request.MainImage),
                (Name: "GalleryImage1", File: request.GalleryImage1),
                (Name: "GalleryImage2", File: request.GalleryImage2),
                (Name: "GalleryImage3", File: request.GalleryImage3)
            };

        if (files.All(item => item.File is null))
        {
            return [new Error("Validation.VehiclePhotos", "Upload at least one vehicle photo.")];
        }

        return files
            .Where(item => item.File is not null)
            .SelectMany(item => ValidateVehicleImageFile(item.Name, item.File!))
            .ToList();
    }

    private static IReadOnlyList<Error> ValidateVehicleImageFile(string fieldName, IFormFile file)
    {
        var errors = new List<Error>();

        if (file.Length <= 0)
        {
            errors.Add(new Error($"Validation.{fieldName}", $"{fieldName} is empty."));
        }

        if (file.Length > MaxVehicleImageSizeBytes)
        {
            errors.Add(new Error($"Validation.{fieldName}", $"{fieldName} must be 10 MB or smaller."));
        }

        if (!AllowedVehicleImageContentTypes.Contains(file.ContentType))
        {
            errors.Add(new Error($"Validation.{fieldName}", $"{fieldName} must be JPEG, PNG, or WebP."));
        }

        return errors;
    }

    public class VehiclePhotoUploadRequest
    {
        public IFormFile? MainImage { get; set; }
        public IFormFile? GalleryImage1 { get; set; }
        public IFormFile? GalleryImage2 { get; set; }
        public IFormFile? GalleryImage3 { get; set; }
    }

    private sealed record VehicleImageUrls(
        string? MainImageUrl,
        string? GalleryImageUrl1,
        string? GalleryImageUrl2,
        string? GalleryImageUrl3);
}
