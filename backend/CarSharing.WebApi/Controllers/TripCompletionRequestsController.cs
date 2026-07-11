using CarSharing.Application.Common.Models;
using CarSharing.Application.Trips.Dtos;
using CarSharing.Application.Trips.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/trip-completion-requests")]
public class TripCompletionRequestsController : ControllerBase
{
    private readonly ITripService _tripService;

    public TripCompletionRequestsController(ITripService tripService)
    {
        _tripService = tripService;
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending(CancellationToken cancellationToken)
    {
        var result = await _tripService.GetPendingCompletionRequestsAsync(cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _tripService.GetCompletionRequestByIdAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken cancellationToken)
    {
        var result = await _tripService.ApproveCompletionRequestAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(
        Guid id,
        RejectTripCompletionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _tripService.RejectCompletionRequestAsync(id, request, cancellationToken);

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

        if (errors.Any(error => error.Code is "Trip.Forbidden" or "TripCompletion.StaffRequired"))
        {
            return Forbid();
        }

        if (errors.Any(error => error.Code is "Trip.NotFound" or "TripCompletion.NotFound"))
        {
            return NotFound(new { errors });
        }

        if (errors.Any(error => error.Code.StartsWith("TripCompletion.")))
        {
            return Conflict(new { errors });
        }

        return BadRequest(new { errors });
    }
}
