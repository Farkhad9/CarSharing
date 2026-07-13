using CarSharing.Domain.Entities;

namespace CarSharing.Application.Pricing.Services;

public interface IDynamicPricingService
{
    Task<DynamicPricingResult> CalculateAsync(
        Vehicle vehicle,
        DateTime utcNow,
        CancellationToken cancellationToken = default);
}
