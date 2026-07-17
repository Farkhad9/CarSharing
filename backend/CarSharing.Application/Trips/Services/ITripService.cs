using CarSharing.Application.Common.Models;
using CarSharing.Application.Trips.Dtos;

namespace CarSharing.Application.Trips.Services;

public interface ITripService
{
    Task<Result<TripDto>> StartAsync(StartTripRequest request, CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<TripDto>>> GetMyActiveAsync(CancellationToken cancellationToken = default);
    Task<Result<TripDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<TripDto>> ApplyPromoCodeAsync(
        Guid tripId,
        ApplyTripPromoCodeRequest request,
        CancellationToken cancellationToken = default);
    Task<Result<TripCompletionRequestDto>> SubmitCompletionAsync(
        Guid tripId,
        IReadOnlyList<TripCompletionPhotoUpload> photos,
        CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<TripCompletionRequestDto>>> GetPendingCompletionRequestsAsync(CancellationToken cancellationToken = default);
    Task<Result<TripCompletionRequestDto>> GetCompletionRequestByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<TripCompletionRequestDto>> ApproveCompletionRequestAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<TripCompletionRequestDto>> RejectCompletionRequestAsync(
        Guid id,
        RejectTripCompletionRequest request,
        CancellationToken cancellationToken = default);
}
