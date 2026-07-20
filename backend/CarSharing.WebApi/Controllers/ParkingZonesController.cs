using CarSharing.Application.Common.Models;
using CarSharing.Application.ParkingZones.Dtos;
using CarSharing.Application.ParkingZones.Services;
using CarSharing.WebApi.Auth;
using CarSharing.WebApi.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/parking-zones")]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
public sealed class ParkingZonesController : ControllerBase
{
    private readonly IParkingZoneService _parkingZoneService;
    private readonly IHubContext<OperationsHub> _operationsHub;

    public ParkingZonesController(
        IParkingZoneService parkingZoneService,
        IHubContext<OperationsHub> operationsHub)
    {
        _parkingZoneService = parkingZoneService;
        _operationsHub = operationsHub;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive, CancellationToken cancellationToken)
    {
        var result = await _parkingZoneService.GetAllAsync(includeInactive, cancellationToken);
        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _parkingZoneService.GetByIdAsync(id, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.SuperAdminOnly)]
    public async Task<IActionResult> Create(UpsertParkingZoneRequest request, CancellationToken cancellationToken)
    {
        var result = await _parkingZoneService.CreateAsync(request, cancellationToken);
        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        await BroadcastParkingZonesChangedAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdminOnly)]
    public async Task<IActionResult> Update(Guid id, UpsertParkingZoneRequest request, CancellationToken cancellationToken)
    {
        var result = await _parkingZoneService.UpdateAsync(id, request, cancellationToken);
        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        await BroadcastParkingZonesChangedAsync(cancellationToken);
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdminOnly)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var result = await _parkingZoneService.DeactivateAsync(id, cancellationToken);
        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        await BroadcastParkingZonesChangedAsync(cancellationToken);
        return NoContent();
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code.StartsWith("Validation.")))
        {
            return BadRequest(new { errors });
        }

        if (errors.Any(error => error.Code == "ParkingZone.NotFound"))
        {
            return NotFound(new { errors });
        }

        return BadRequest(new { errors });
    }

    private async Task BroadcastParkingZonesChangedAsync(CancellationToken cancellationToken)
    {
        await _operationsHub.Clients.Group(OperationsHub.AdminsGroup)
            .SendAsync("AdminDataChanged", new { scope = "parkingZones" }, cancellationToken);
    }
}
