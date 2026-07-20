using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public class UserExternalLoginRepository : IUserExternalLoginRepository
{
    private readonly AppDbContext _dbContext;

    public UserExternalLoginRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<UserExternalLogin?> GetByProviderAsync(
        string provider,
        string providerUserId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.UserExternalLogins
            .FirstOrDefaultAsync(
                login => login.Provider == provider && login.ProviderUserId == providerUserId,
                cancellationToken);
    }

    public async Task<bool> ExistsAsync(
        Guid userId,
        string provider,
        string providerUserId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.UserExternalLogins
            .AnyAsync(
                login => login.UserId == userId && login.Provider == provider && login.ProviderUserId == providerUserId,
                cancellationToken);
    }

    public async Task AddAsync(UserExternalLogin externalLogin, CancellationToken cancellationToken = default)
    {
        await _dbContext.UserExternalLogins.AddAsync(externalLogin, cancellationToken);
    }
}
