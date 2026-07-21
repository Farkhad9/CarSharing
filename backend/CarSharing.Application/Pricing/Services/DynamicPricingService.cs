using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.Pricing.Services;

public sealed class DynamicPricingService : IDynamicPricingService
{
    private const decimal MinimumPricePerMinute = 0.05m;
    private readonly IPricingPolicyRepository? _pricingPolicyRepository;

    public DynamicPricingService(
        IVehicleRepository vehicleRepository,
        IPricingPolicyRepository? pricingPolicyRepository = null)
    {
        _ = vehicleRepository;
        _pricingPolicyRepository = pricingPolicyRepository;
    }

    public async Task<DynamicPricingResult> CalculateAsync(
        Vehicle vehicle,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var policy = _pricingPolicyRepository is null
            ? null
            : await _pricingPolicyRepository.GetCurrentAsync(cancellationToken);
        var pricingMode = policy?.Mode ?? PricingMode.Standard;
        var manualAdjustmentAmount = policy?.AdjustmentAmount ?? PricingPolicy.GetAdjustmentAmount(pricingMode);
        var finalPricePerMinute = RoundMoney(
            Math.Max(
                MinimumPricePerMinute,
                vehicle.PricePerMinute + manualAdjustmentAmount));

        return new DynamicPricingResult(
            vehicle.PricePerMinute,
            1.00m,
            1.00m,
            1.00m,
            manualAdjustmentAmount,
            pricingMode.ToString(),
            finalPricePerMinute);
    }

    private static decimal RoundMoney(decimal value)
    {
        return Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
