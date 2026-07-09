using CarSharing.Domain.Enums;

namespace CarSharing.Application.Reservations.Dtos;

public class ReservationDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
    public DateTime ReservedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? ExpiredAt { get; set; }
    public DateTime? ConvertedToTripAt { get; set; }
    public decimal HoldAmount { get; set; }
    public string Currency { get; set; } = null!;
    public string? CancelReason { get; set; }
    public ReservationStatus Status { get; set; }
}
