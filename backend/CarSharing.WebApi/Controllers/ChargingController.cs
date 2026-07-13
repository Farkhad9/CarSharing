using CarSharing.Application.Charging.Dtos;
using CarSharing.Application.Charging.Services;
using CarSharing.Application.Common.Models;
using CarSharing.WebApi.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/charging")]
public sealed class ChargingController : ControllerBase
{
    private readonly IChargingService _chargingService;

    public ChargingController(IChargingService chargingService)
    {
        _chargingService = chargingService;
    }

    [HttpGet("stations")]
    public async Task<IActionResult> GetStations(CancellationToken cancellationToken)
    {
        var result = await _chargingService.GetStationsAsync(cancellationToken);
        return Ok(result.Value);
    }

    [HttpGet("stations/{id:guid}")]
    public async Task<IActionResult> GetStationById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _chargingService.GetStationByIdAsync(id, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost("stations")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> CreateStation(
        CreateChargingStationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _chargingService.CreateStationAsync(request, cancellationToken);
        return result.IsFailure
            ? ToErrorResponse(result.Errors)
            : CreatedAtAction(nameof(GetStationById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPatch("stations/{id:guid}/status")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> UpdateStationStatus(
        Guid id,
        UpdateChargingStationStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _chargingService.UpdateStationStatusAsync(id, request, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpGet("sessions/active")]
    [Authorize(Policy = AuthorizationPolicies.StaffOrAdmin)]
    public async Task<IActionResult> GetActiveSessions(CancellationToken cancellationToken)
    {
        var result = await _chargingService.GetActiveSessionsAsync(cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost("sessions/start")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> StartSession(
        StartChargingSessionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _chargingService.StartChargingAsync(request, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost("sessions/{id:guid}/complete")]
    [Authorize(Policy = AuthorizationPolicies.StaffOrAdmin)]
    public async Task<IActionResult> CompleteSession(
        Guid id,
        CompleteChargingSessionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _chargingService.CompleteChargingAsync(id, request, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost("vehicles/{vehicleId:guid}/activate")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> ActivateVehicle(Guid vehicleId, CancellationToken cancellationToken)
    {
        var result = await _chargingService.ActivateVehicleAsync(vehicleId, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(new { activated = result.Value });
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code.StartsWith("Validation.")))
        {
            return BadRequest(new { errors });
        }

        if (errors.Any(error => error.Code is "Charging.Unauthenticated"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code is "Charging.AdminRequired" or "Charging.StaffRequired"))
        {
            return Forbid();
        }

        if (errors.Any(error => error.Code is "Charging.VehicleNotFound" or "Charging.StationNotFound" or "Charging.SessionNotFound"))
        {
            return NotFound(new { errors });
        }

        if (errors.Any(error => error.Code.StartsWith("Charging.")))
        {
            return Conflict(new { errors });
        }

        return BadRequest(new { errors });
    }
}
