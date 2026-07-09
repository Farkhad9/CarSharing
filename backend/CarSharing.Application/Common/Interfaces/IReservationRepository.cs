using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IReservationRepository
{
    Task<Reservation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Reservation>> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<int> CountActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Reservation>> GetExpiredActiveAsync(DateTime utcNow, CancellationToken cancellationToken = default);
    Task AddAsync(Reservation reservation, CancellationToken cancellationToken = default);
}
