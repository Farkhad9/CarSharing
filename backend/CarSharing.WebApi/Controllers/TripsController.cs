using CarSharing.Application.Common.Models;
using CarSharing.Application.Trips.Dtos;
using CarSharing.Application.Trips.Services;
using CarSharing.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/trips")]
public class TripsController : ControllerBase
{
    private readonly ITripService _tripService;

    public TripsController(ITripService tripService)
    {
        _tripService = tripService;
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start(
        StartTripRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _tripService.StartAsync(request, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("my/active")]
    public async Task<IActionResult> GetMyActive(CancellationToken cancellationToken)
    {
        var result = await _tripService.GetMyActiveAsync(cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _tripService.GetByIdAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/completion-requests")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(70 * 1024 * 1024)]
    public async Task<IActionResult> SubmitCompletionRequest(
        Guid id,
        [FromForm] SubmitTripCompletionForm form,
        CancellationToken cancellationToken)
    {
        var photos = form.ToUploads();
        var result = await _tripService.SubmitCompletionAsync(id, photos, cancellationToken);

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

        if (errors.Any(error => error.Code == "Trip.Unauthenticated"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code == "Trip.Forbidden"))
        {
            return Forbid();
        }

        if (errors.Any(error => error.Code is "Trip.NotFound" or "Trip.ReservationNotFound" or "Trip.VehicleNotFound"))
        {
            return NotFound(new { errors });
        }

        if (errors.Any(error => error.Code.StartsWith("Trip.")))
        {
            return Conflict(new { errors });
        }

        return BadRequest(new { errors });
    }
}

public class SubmitTripCompletionForm
{
    public IFormFile? FrontPhoto { get; set; }
    public IFormFile? RearPhoto { get; set; }
    public IFormFile? LeftPhoto { get; set; }
    public IFormFile? RightPhoto { get; set; }

    public IReadOnlyList<TripCompletionPhotoUpload> ToUploads()
    {
        return new[]
            {
                ToUpload(TripPhotoAngle.Front, FrontPhoto),
                ToUpload(TripPhotoAngle.Rear, RearPhoto),
                ToUpload(TripPhotoAngle.Left, LeftPhoto),
                ToUpload(TripPhotoAngle.Right, RightPhoto)
            }
            .Where(upload => upload is not null)
            .Cast<TripCompletionPhotoUpload>()
            .ToList();
    }

    private static TripCompletionPhotoUpload? ToUpload(TripPhotoAngle angle, IFormFile? file)
    {
        return file is null
            ? null
            : new TripCompletionPhotoUpload(
                angle,
                file.FileName,
                file.ContentType,
                file.Length,
                file.OpenReadStream);
    }
}
