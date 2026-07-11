using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public class TripRepository : ITripRepository
{
    private readonly AppDbContext _dbContext;

    public TripRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Trips
            .FirstOrDefaultAsync(trip => trip.Id == id, cancellationToken);
    }

    public async Task<Trip?> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Trips
            .Where(trip => trip.UserId == userId
                && trip.Status != TripStatus.Completed
                && trip.Status != TripStatus.Cancelled)
            .OrderByDescending(trip => trip.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Trip?> GetByReservationIdAsync(Guid reservationId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Trips
            .FirstOrDefaultAsync(trip => trip.ReservationId == reservationId, cancellationToken);
    }

    public async Task AddAsync(Trip trip, CancellationToken cancellationToken = default)
    {
        await _dbContext.Trips.AddAsync(trip, cancellationToken);
    }
}
