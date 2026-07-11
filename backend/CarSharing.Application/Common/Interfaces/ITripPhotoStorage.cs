using CarSharing.Domain.Enums;

namespace CarSharing.Application.Common.Interfaces;

public interface ITripPhotoStorage
{
    Task<string> SaveAsync(
        Guid tripId,
        Guid completionRequestId,
        TripPhotoAngle angle,
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken = default);
}
