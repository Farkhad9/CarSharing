using CarSharing.Domain.Enums;

namespace CarSharing.Application.Trips.Dtos;

public class TripCompletionRequestDto
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid? AssigneeId { get; set; }
    public int AttemptNumber { get; set; }
    public TripCompletionStatus Status { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public decimal BaseRideCost { get; set; }
    public int DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal FinalRideCost { get; set; }
    public string Currency { get; set; } = "AZN";
    public string? PromoCode { get; set; }
    public string? RejectionReason { get; set; }
    public IReadOnlyList<TripCompletionPhotoDto> Photos { get; set; } = [];
}
