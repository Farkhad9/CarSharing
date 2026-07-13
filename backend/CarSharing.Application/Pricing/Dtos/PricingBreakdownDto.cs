namespace CarSharing.Application.Pricing.Dtos;

public sealed record PricingBreakdownDto(
    decimal BasePricePerMinute,
    decimal DemandMultiplier,
    decimal ZoneMultiplier,
    decimal BatteryMultiplier,
    decimal FinalPricePerMinute,
    int DurationMinutes,
    decimal BasePrice,
    decimal DiscountAmount,
    decimal TotalPrice,
    string Currency);
