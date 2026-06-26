using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class Reservation
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
    public DateTime ReservedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? ConvertedToTripAt { get; set; }
    public decimal HoldAmount { get; set; }
    public string Currency { get; set; } = "AZN";
    public ReservationStatus Status { get; set; } = ReservationStatus.Active;
}
