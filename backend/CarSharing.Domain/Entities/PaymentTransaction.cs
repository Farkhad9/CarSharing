using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class PaymentTransaction : BaseEntity
{
    private PaymentTransaction() { }

    public Guid UserId { get; private set; }
    public Guid? TripId { get; private set; }
    public Guid? ReservationId { get; private set; }
    public PaymentTransactionType Type { get; private set; }
    public PaymentTransactionStatus Status { get; private set; } = PaymentTransactionStatus.Pending;
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = "AZN";
    public string? PaymentMethod { get; private set; }
    public string? ExternalReference { get; private set; }
    public string? CardBrand { get; private set; }
    public string? CardLast4 { get; private set; }
    public string? FailureReason { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    public static PaymentTransaction CreateTopUp(Guid userId, decimal amount, string paymentMethod, DateTime now)
        => Create(userId, null, PaymentTransactionType.TopUp, amount, paymentMethod, now);

    public static PaymentTransaction CreateTripPayment(Guid userId, Guid tripId, decimal amount, DateTime now)
        => Create(userId, tripId, PaymentTransactionType.RidePayment, amount, "Balance", now);

    private static PaymentTransaction Create(Guid userId, Guid? tripId, PaymentTransactionType type, decimal amount, string method, DateTime now)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
        return new PaymentTransaction { Id = Guid.NewGuid(), UserId = userId, TripId = tripId, Type = type, Amount = amount,
            PaymentMethod = method.Trim(), Status = PaymentTransactionStatus.Pending, CreatedAt = now };
    }

    public void Complete(DateTime now)
    {
        Status = PaymentTransactionStatus.Completed;
        CompletedAt = now;
        FailureReason = null;
    }

    public void Fail(string reason)
    {
        Status = PaymentTransactionStatus.Failed;
        FailureReason = reason.Trim();
    }

    public void SetExternalPayment(string externalReference, string? cardBrand = null, string? cardLast4 = null)
    {
        ExternalReference = externalReference.Trim();
        CardBrand = string.IsNullOrWhiteSpace(cardBrand) ? null : cardBrand.Trim();
        CardLast4 = string.IsNullOrWhiteSpace(cardLast4) ? null : cardLast4.Trim();
    }
}
