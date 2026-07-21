using CarSharing.Domain.Enums;

namespace CarSharing.Application.Pricing.Dtos;

public sealed record PricingPolicyDto(
    Guid Id,
    PricingMode Mode,
    decimal AdjustmentAmount,
    string Label,
    string Description,
    Guid? UpdatedByUserId,
    DateTime UpdatedAt);

public sealed record UpdatePricingModeRequest(PricingMode Mode);
