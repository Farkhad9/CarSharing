using CarSharing.Application.Common.Models;
using CarSharing.Application.Reservations.Dtos;
using CarSharing.Application.Reservations.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/reservations")]
public class ReservationsController : ControllerBase
{
    private readonly IReservationService _reservationService;

    public ReservationsController(IReservationService reservationService)
    {
        _reservationService = reservationService;
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        CreateReservationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _reservationService.CreateAsync(request, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyActive(CancellationToken cancellationToken)
    {
        var result = await _reservationService.GetMyActiveAsync(cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _reservationService.GetByIdAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(
        Guid id,
        CancelReservationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _reservationService.CancelAsync(id, request, cancellationToken);

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

        if (errors.Any(error => error.Code == "Reservation.Unauthenticated"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code == "Reservation.Forbidden"))
        {
            return Forbid();
        }

        if (errors.Any(error => error.Code is "Reservation.NotFound" or "Reservation.VehicleNotFound"))
        {
            return NotFound(new { errors });
        }

        if (errors.Any(error => error.Code is "Reservation.VehicleNotAvailable"
            or "Reservation.TooManyActiveReservations"
            or "Reservation.PassengerCapacityExceeded"
            or "Reservation.CannotCancel"))
        {
            return Conflict(new { errors });
        }

        return BadRequest(new { errors });
    }
}
