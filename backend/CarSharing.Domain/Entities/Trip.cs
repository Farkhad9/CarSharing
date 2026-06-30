using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class Trip : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid? ReservationId { get; set; }
    public TripStatus Status { get; set; } = TripStatus.Active;
    public DateTime StartedAt { get; set; }
    public DateTime? PausedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string StartLocationLabel { get; set; } = null!;
    public double StartLatitude { get; set; }
    public double StartLongitude { get; set; }
    public string? EndLocationLabel { get; set; }
    public double? EndLatitude { get; set; }
    public double? EndLongitude { get; set; }
    public double DistanceKm { get; set; }
    public decimal PricePerMinute { get; set; }
    public decimal BasePrice { get; set; }
    public int DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "AZN";
    public string? PromoCode { get; set; }
}
