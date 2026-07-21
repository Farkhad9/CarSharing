using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IPricingPolicyRepository
{
    Task<PricingPolicy?> GetCurrentAsync(CancellationToken cancellationToken = default);
    Task AddAsync(PricingPolicy policy, CancellationToken cancellationToken = default);
}
