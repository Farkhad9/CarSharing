using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface ITripCompletionRequestRepository
{
    Task<TripCompletionRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<TripCompletionRequest?> GetLatestByTripIdAsync(Guid tripId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TripCompletionRequest>> GetPendingReviewAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TripCompletionRequest>> GetReviewedByUserIdAsync(
        Guid reviewedByUserId,
        int take = 50,
        CancellationToken cancellationToken = default);
    Task AddAsync(TripCompletionRequest request, CancellationToken cancellationToken = default);
}
