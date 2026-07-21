using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class PricingPolicyRepository : IPricingPolicyRepository
{
    private readonly AppDbContext _dbContext;

    public PricingPolicyRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<PricingPolicy?> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        return _dbContext.PricingPolicies
            .FirstOrDefaultAsync(policy => policy.Id == PricingPolicy.DefaultId, cancellationToken);
    }

    public async Task AddAsync(PricingPolicy policy, CancellationToken cancellationToken = default)
    {
        await _dbContext.PricingPolicies.AddAsync(policy, cancellationToken);
    }
}
