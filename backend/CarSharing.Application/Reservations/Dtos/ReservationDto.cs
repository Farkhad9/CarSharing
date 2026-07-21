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
    public string DestinationLabel { get; set; } = string.Empty;
    public double DestinationLatitude { get; set; }
    public double DestinationLongitude { get; set; }
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string? MainImageUrl { get; set; }
    public string? GalleryImageUrl1 { get; set; }
    public string? GalleryImageUrl2 { get; set; }
    public string? GalleryImageUrl3 { get; set; }
    public string LocationLabel { get; set; } = string.Empty;
    public string Zone { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public decimal PricePerMinute { get; set; }
    public ReservationStatus Status { get; set; }
}
