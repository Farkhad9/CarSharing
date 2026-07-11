using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class TripCompletionRequest : BaseEntity
{
    private readonly List<TripCompletionPhoto> _photos = [];

    private TripCompletionRequest()
    {
    }

    public Guid TripId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid VehicleId { get; private set; }
    public Guid? AssigneeId { get; private set; }
    public int AttemptNumber { get; private set; }
    public TripCompletionStatus Status { get; private set; } = TripCompletionStatus.PendingReview;
    public DateTime RequestedAt { get; private set; }
    public DateTime? ReviewedAt { get; private set; }
    public Guid? ReviewedByUserId { get; private set; }
    public decimal BaseRideCost { get; private set; }
    public int DiscountPercent { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal FinalRideCost { get; private set; }
    public string Currency { get; private set; } = "AZN";
    public string? PromoCode { get; private set; }
    public string? RejectionReason { get; private set; }
    public IReadOnlyCollection<TripCompletionPhoto> Photos => _photos;

    public static TripCompletionRequest Create(Trip trip, int attemptNumber, DateTime requestedAt)
    {
        return new TripCompletionRequest
        {
            Id = Guid.NewGuid(),
            TripId = trip.Id,
            UserId = trip.UserId,
            VehicleId = trip.VehicleId,
            AttemptNumber = attemptNumber,
            Status = TripCompletionStatus.PendingReview,
            RequestedAt = requestedAt,
            BaseRideCost = trip.BasePrice,
            DiscountPercent = trip.DiscountPercent,
            DiscountAmount = trip.DiscountAmount,
            FinalRideCost = trip.TotalPrice,
            Currency = trip.Currency,
            PromoCode = trip.PromoCode
        };
    }

    public void AssignTo(Guid staffUserId)
    {
        AssigneeId = staffUserId;
    }

    public void AddPhoto(TripPhotoAngle angle, string fileUrl, DateTime uploadedAt)
    {
        _photos.Add(TripCompletionPhoto.Create(Id, angle, fileUrl, uploadedAt));
    }

    public void Approve(Guid reviewedByUserId, DateTime reviewedAt)
    {
        Status = TripCompletionStatus.Approved;
        ReviewedByUserId = reviewedByUserId;
        ReviewedAt = reviewedAt;
        RejectionReason = null;
    }

    public void Reject(Guid reviewedByUserId, DateTime reviewedAt, string reason)
    {
        Status = TripCompletionStatus.Rejected;
        ReviewedByUserId = reviewedByUserId;
        ReviewedAt = reviewedAt;
        RejectionReason = reason.Trim();
    }
}
