using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;

namespace CarSharing.Application.Pricing.Services;

public sealed class DynamicPricingService : IDynamicPricingService
{
    private const int LowAvailableVehiclesInZone = 3;
    private readonly IVehicleRepository _vehicleRepository;

    public DynamicPricingService(IVehicleRepository vehicleRepository)
    {
        _vehicleRepository = vehicleRepository;
    }

    public async Task<DynamicPricingResult> CalculateAsync(
        Vehicle vehicle,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var availableInZone = await _vehicleRepository.CountAvailableByZoneAsync(vehicle.Zone, cancellationToken);
        var demandMultiplier = CalculateDemandMultiplier(utcNow, availableInZone);
        var zoneMultiplier = CalculateZoneMultiplier(vehicle.Zone);
        var batteryMultiplier = CalculateBatteryMultiplier(vehicle.BatteryPercent);
        var finalPricePerMinute = RoundMoney(
            vehicle.PricePerMinute * demandMultiplier * zoneMultiplier * batteryMultiplier);

        return new DynamicPricingResult(
            vehicle.PricePerMinute,
            demandMultiplier,
            zoneMultiplier,
            batteryMultiplier,
            finalPricePerMinute);
    }

    public static decimal CalculateDemandMultiplier(DateTime utcNow, int availableVehiclesInZone)
    {
        if (IsPeakHour(utcNow) && availableVehiclesInZone < LowAvailableVehiclesInZone)
        {
            return 1.25m;
        }

        return IsPeakHour(utcNow) ? 1.15m : 1.00m;
    }

    public static decimal CalculateZoneMultiplier(string zone)
    {
        var normalizedZone = zone.Trim().ToUpperInvariant();

        return normalizedZone switch
        {
            "CENTER" or "CENTRAL" => 1.10m,
            "SEASIDE" => 1.05m,
            "AIRPORT" => 1.20m,
            _ => 1.00m
        };
    }

    public static decimal CalculateBatteryMultiplier(int batteryPercent)
    {
        return batteryPercent switch
        {
            >= 85 => 1.03m,
            >= 65 => 1.00m,
            >= 45 => 0.97m,
            _ => 0.95m
        };
    }

    private static bool IsPeakHour(DateTime utcNow)
    {
        var bakuTime = utcNow.AddHours(4);
        var hour = bakuTime.Hour;
        return hour is >= 8 and < 10 or >= 18 and < 21;
    }

    private static decimal RoundMoney(decimal value)
    {
        return Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
