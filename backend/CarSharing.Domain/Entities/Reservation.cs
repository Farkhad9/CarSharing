using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class Reservation : BaseEntity
{
    private Reservation()
    {
    }

    public Guid UserId { get; private set; }
    public Guid VehicleId { get; private set; }
    public DateTime ReservedAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public DateTime? ExpiredAt { get; private set; }
    public DateTime? ConvertedToTripAt { get; private set; }
    public decimal HoldAmount { get; private set; }
    public string Currency { get; private set; } = "AZN";
    public string? CancelReason { get; private set; }
    public ReservationStatus Status { get; private set; } = ReservationStatus.Active;

    public static Reservation Create(
        Guid userId,
        Guid vehicleId,
        DateTime reservedAt,
        DateTime expiresAt,
        decimal holdAmount = 0,
        string currency = "AZN")
    {
        return new Reservation
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VehicleId = vehicleId,
            ReservedAt = reservedAt,
            ExpiresAt = expiresAt,
            HoldAmount = holdAmount,
            Currency = currency.Trim().ToUpperInvariant(),
            Status = ReservationStatus.Active
        };
    }

    public void Cancel(DateTime cancelledAt, string? reason = null)
    {
        Status = ReservationStatus.Cancelled;
        CancelledAt = cancelledAt;
        CancelReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }

    public void Expire(DateTime expiredAt)
    {
        Status = ReservationStatus.Expired;
        ExpiredAt = expiredAt;
    }
}
