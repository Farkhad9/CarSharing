using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public class ReservationRepository : IReservationRepository
{
    private readonly AppDbContext _dbContext;

    public ReservationRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Reservation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Reservations
            .FirstOrDefaultAsync(reservation => reservation.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Reservation>> GetActiveByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Reservations
            .Where(reservation => reservation.UserId == userId && reservation.Status == ReservationStatus.Active)
            .OrderBy(reservation => reservation.ExpiresAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> CountActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Reservations
            .CountAsync(reservation => reservation.UserId == userId && reservation.Status == ReservationStatus.Active, cancellationToken);
    }

    public async Task<IReadOnlyList<Reservation>> GetExpiredActiveAsync(
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Reservations
            .Where(reservation => reservation.Status == ReservationStatus.Active && reservation.ExpiresAt <= utcNow)
            .OrderBy(reservation => reservation.ExpiresAt)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(Reservation reservation, CancellationToken cancellationToken = default)
    {
        await _dbContext.Reservations.AddAsync(reservation, cancellationToken);
    }
}
