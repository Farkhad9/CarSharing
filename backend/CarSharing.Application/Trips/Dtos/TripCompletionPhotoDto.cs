using CarSharing.Domain.Enums;

namespace CarSharing.Application.Trips.Dtos;

public class TripCompletionPhotoDto
{
    public Guid Id { get; set; }
    public TripPhotoAngle Angle { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
}
