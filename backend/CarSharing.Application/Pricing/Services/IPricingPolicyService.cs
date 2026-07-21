using CarSharing.Application.Common.Models;
using CarSharing.Application.Pricing.Dtos;

namespace CarSharing.Application.Pricing.Services;

public interface IPricingPolicyService
{
    Task<Result<PricingPolicyDto>> GetCurrentAsync(CancellationToken cancellationToken = default);
    Task<Result<PricingPolicyDto>> UpdateModeAsync(UpdatePricingModeRequest request, CancellationToken cancellationToken = default);
}
