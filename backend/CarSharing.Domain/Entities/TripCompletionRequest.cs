using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class TripCompletionRequest
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid AssigneeId { get; set; }
    public TripCompletionStatus Status { get; set; } = TripCompletionStatus.Pending;
    public DateTime RequestedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public decimal BaseRideCost { get; set; }
    public int DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal FinalRideCost { get; set; }
    public string Currency { get; set; } = "AZN";
    public string? PromoCode { get; set; }
    public string? PaymentMethod { get; set; }
    public string? RejectionReason { get; set; }
    public List<string> PhotoUrls { get; set; } = [];
}
