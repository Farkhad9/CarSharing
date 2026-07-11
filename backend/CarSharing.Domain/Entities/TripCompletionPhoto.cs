using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class TripCompletionPhoto : BaseEntity
{
    private TripCompletionPhoto()
    {
    }

    public Guid TripCompletionRequestId { get; private set; }
    public TripPhotoAngle Angle { get; private set; }
    public string FileUrl { get; private set; } = null!;
    public DateTime UploadedAt { get; private set; }

    public static TripCompletionPhoto Create(
        Guid tripCompletionRequestId,
        TripPhotoAngle angle,
        string fileUrl,
        DateTime uploadedAt)
    {
        return new TripCompletionPhoto
        {
            Id = Guid.NewGuid(),
            TripCompletionRequestId = tripCompletionRequestId,
            Angle = angle,
            FileUrl = fileUrl.Trim(),
            UploadedAt = uploadedAt
        };
    }
}
