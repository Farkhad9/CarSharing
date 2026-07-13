using CarSharing.Application.Pricing.Services;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class DynamicPricingTests
{
    [Theory]
    [InlineData(85, 1.03)]
    [InlineData(70, 1.00)]
    [InlineData(65, 1.00)]
    [InlineData(64, 0.97)]
    [InlineData(45, 0.97)]
    [InlineData(44, 0.95)]
    public void CalculateBatteryMultiplier_uses_configured_ranges(
        int batteryPercent,
        decimal expectedMultiplier)
    {
        var result = DynamicPricingService.CalculateBatteryMultiplier(batteryPercent);

        Assert.Equal(expectedMultiplier, result);
    }

    [Theory]
    [InlineData("Center", 1.10)]
    [InlineData("Central", 1.10)]
    [InlineData("Seaside", 1.05)]
    [InlineData("Airport", 1.20)]
    [InlineData("Suburbs", 1.00)]
    public void CalculateZoneMultiplier_uses_zone_rules(string zone, decimal expectedMultiplier)
    {
        var result = DynamicPricingService.CalculateZoneMultiplier(zone);

        Assert.Equal(expectedMultiplier, result);
    }

    [Fact]
    public void CalculateDemandMultiplier_uses_peak_and_low_supply()
    {
        var peak = new DateTime(2026, 7, 12, 14, 0, 0, DateTimeKind.Utc);
        var offPeak = new DateTime(2026, 7, 12, 12, 0, 0, DateTimeKind.Utc);

        Assert.Equal(1.25m, DynamicPricingService.CalculateDemandMultiplier(peak, 2));
        Assert.Equal(1.15m, DynamicPricingService.CalculateDemandMultiplier(peak, 3));
        Assert.Equal(1.00m, DynamicPricingService.CalculateDemandMultiplier(offPeak, 1));
    }
}
