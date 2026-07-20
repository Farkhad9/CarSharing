using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IUserExternalLoginRepository
{
    Task<UserExternalLogin?> GetByProviderAsync(string provider, string providerUserId, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(Guid userId, string provider, string providerUserId, CancellationToken cancellationToken = default);
    Task AddAsync(UserExternalLogin externalLogin, CancellationToken cancellationToken = default);
}
