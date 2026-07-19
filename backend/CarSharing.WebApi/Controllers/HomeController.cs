using CarSharing.Domain.Enums;
using CarSharing.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/home")]
public sealed class HomeController : ControllerBase
{
    private const int ReadyBatteryThresholdPercent = 60;
    private const int KnownBakuHotspots = 6;
    private readonly AppDbContext _dbContext;

    public HomeController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken cancellationToken)
    {
        var vehicleSummary = await _dbContext.Vehicles
            .GroupBy(_ => 1)
            .Select(group => new
            {
                TotalVehicles = group.Count(),
                AvailableVehicles = group.Count(vehicle => vehicle.Status == VehicleStatus.Available),
                ChargingVehicles = group.Count(vehicle => vehicle.Status == VehicleStatus.Charging),
                MinPricePerMinute = group.Min(vehicle => (decimal?)vehicle.PricePerMinute),
                AverageBatteryPercent = group.Average(vehicle => (double?)vehicle.BatteryPercent),
                ReadyAvailableVehicles = group.Count(vehicle =>
                    vehicle.Status == VehicleStatus.Available &&
                    vehicle.BatteryPercent >= ReadyBatteryThresholdPercent),
                CoveredZones = group
                    .Select(vehicle => vehicle.Zone)
                    .Where(zone => zone != "")
                    .Distinct()
                    .Count()
            })
            .FirstOrDefaultAsync(cancellationToken);

        var completedTrips = await _dbContext.Trips
            .CountAsync(trip => trip.Status == TripStatus.Completed, cancellationToken);

        var totalVehicles = vehicleSummary?.TotalVehicles ?? 0;
        var availableVehicles = vehicleSummary?.AvailableVehicles ?? 0;
        var readyAvailableVehicles = vehicleSummary?.ReadyAvailableVehicles ?? 0;
        var coveredZones = vehicleSummary?.CoveredZones ?? 0;
        var cityCenterCoveragePercent = Math.Min(
            100,
            (int)Math.Round(coveredZones * 100m / KnownBakuHotspots, MidpointRounding.AwayFromZero));

        return Ok(new HomeSummaryResponse(
            totalVehicles,
            availableVehicles,
            vehicleSummary?.ChargingVehicles ?? 0,
            completedTrips,
            vehicleSummary?.MinPricePerMinute ?? 0m,
            vehicleSummary?.AverageBatteryPercent is null
                ? 0
                : (int)Math.Round(vehicleSummary.AverageBatteryPercent.Value, MidpointRounding.AwayFromZero),
            readyAvailableVehicles,
            availableVehicles > 0 && readyAvailableVehicles == availableVehicles,
            ReadyBatteryThresholdPercent,
            coveredZones,
            cityCenterCoveragePercent));
    }

    private sealed record HomeSummaryResponse(
        int TotalVehicles,
        int AvailableVehicles,
        int ChargingVehicles,
        int CompletedTrips,
        decimal MinPricePerMinute,
        int AverageBatteryPercent,
        int ReadyAvailableVehicles,
        bool AllAvailableVehiclesReady,
        int ReadyBatteryThresholdPercent,
        int CoveredZones,
        int CityCenterCoveragePercent);
}
