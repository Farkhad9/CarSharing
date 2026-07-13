namespace CarSharing.Application.Pricing.Services;

public sealed record DynamicPricingResult(
    decimal BasePricePerMinute,
    decimal DemandMultiplier,
    decimal ZoneMultiplier,
    decimal BatteryMultiplier,
    decimal FinalPricePerMinute);
