using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class PaymentTransaction : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid? TripId { get; set; }
    public Guid? ReservationId { get; set; }
    public PaymentTransactionType Type { get; set; }
    public PaymentTransactionStatus Status { get; set; } = PaymentTransactionStatus.Pending;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "AZN";
    public string? PaymentMethod { get; set; }
    public string? ExternalReference { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
