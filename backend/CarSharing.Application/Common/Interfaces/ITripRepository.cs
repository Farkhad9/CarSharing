using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface ITripRepository
{
    Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Trip?> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Trip?> GetByReservationIdAsync(Guid reservationId, CancellationToken cancellationToken = default);
    Task AddAsync(Trip trip, CancellationToken cancellationToken = default);
}
