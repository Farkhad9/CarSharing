using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _dbContext;

    public UserRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<User>> GetAllAsync(
        string? search = null,
        UserRole? role = null,
        bool? isActive = null,
        UserVerificationStatus? verificationStatus = null,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.Trim().ToLowerInvariant();
            query = query.Where(user =>
                user.Email.Contains(normalizedSearch) ||
                user.FirstName.ToLower().Contains(normalizedSearch) ||
                user.LastName.ToLower().Contains(normalizedSearch) ||
                user.Phone.Contains(normalizedSearch));
        }

        if (role.HasValue)
        {
            query = query.Where(user => user.Role == role.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(user => user.IsActive == isActive.Value);
        }

        if (verificationStatus.HasValue)
        {
            query = query.Where(user => user.VerificationStatus == verificationStatus.Value);
        }

        return await query
            .OrderByDescending(user => user.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == id, cancellationToken);
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .FirstOrDefaultAsync(user => user.Email == email, cancellationToken);
    }

    public async Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .FirstOrDefaultAsync(user => user.RefreshTokenHash == refreshTokenHash, cancellationToken);
    }

    public async Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .AnyAsync(user => user.Email == email, cancellationToken);
    }

    public async Task<bool> ExistsByPhoneAsync(string phone, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .AnyAsync(user => user.Phone == phone, cancellationToken);
    }

    public async Task<bool> ExistsByDriverLicenseNumberAsync(string driverLicenseNumber, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .AnyAsync(user => user.DriverLicenseNumber == driverLicenseNumber, cancellationToken);
    }

    public async Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        await _dbContext.Users.AddAsync(user, cancellationToken);
    }
}
