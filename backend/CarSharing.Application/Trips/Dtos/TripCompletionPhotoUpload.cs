using CarSharing.Domain.Enums;

namespace CarSharing.Application.Trips.Dtos;

public sealed record TripCompletionPhotoUpload(
    TripPhotoAngle Angle,
    string FileName,
    string ContentType,
    long Length,
    Func<Stream> OpenReadStream);
