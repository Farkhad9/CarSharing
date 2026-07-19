using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public class TripCompletionRequestRepository : ITripCompletionRequestRepository
{
    private readonly AppDbContext _dbContext;

    public TripCompletionRequestRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TripCompletionRequest?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.TripCompletionRequests
            .Include(request => request.Photos)
            .FirstOrDefaultAsync(request => request.Id == id, cancellationToken);
    }

    public async Task<TripCompletionRequest?> GetLatestByTripIdAsync(
        Guid tripId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.TripCompletionRequests
            .Include(request => request.Photos)
            .Where(request => request.TripId == tripId)
            .OrderByDescending(request => request.AttemptNumber)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TripCompletionRequest>> GetPendingReviewAsync(
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.TripCompletionRequests
            .Include(request => request.Photos)
            .Where(request => request.Status == TripCompletionStatus.PendingReview)
            .OrderBy(request => request.RequestedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TripCompletionRequest>> GetReviewedByUserIdAsync(
        Guid reviewedByUserId,
        int take = 50,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.TripCompletionRequests
            .Include(request => request.Photos)
            .Where(request => request.ReviewedByUserId == reviewedByUserId
                && request.Status != TripCompletionStatus.PendingReview)
            .OrderByDescending(request => request.ReviewedAt)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(TripCompletionRequest request, CancellationToken cancellationToken = default)
    {
        await _dbContext.TripCompletionRequests.AddAsync(request, cancellationToken);
    }
}
