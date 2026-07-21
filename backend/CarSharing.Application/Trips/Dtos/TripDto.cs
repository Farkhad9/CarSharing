using CarSharing.Domain.Enums;
using CarSharing.Application.Pricing.Dtos;

namespace CarSharing.Application.Trips.Dtos;

public class TripDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid? ReservationId { get; set; }
    public TripStatus Status { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndRequestedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int DurationMinutes { get; set; }
    public decimal BasePricePerMinute { get; set; }
    public decimal PricePerMinute { get; set; }
    public decimal DemandMultiplier { get; set; }
    public decimal ZoneMultiplier { get; set; }
    public decimal BatteryMultiplier { get; set; }
    public decimal BasePrice { get; set; }
    public int DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "AZN";
    public string StartLocationLabel { get; set; } = string.Empty;
    public double StartLatitude { get; set; }
    public double StartLongitude { get; set; }
    public string DestinationLabel { get; set; } = string.Empty;
    public double DestinationLatitude { get; set; }
    public double DestinationLongitude { get; set; }
    public int StartBatteryPercent { get; set; }
    public int CurrentBatteryPercent { get; set; }
    public int CurrentRangeKm { get; set; }
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string? MainImageUrl { get; set; }
    public string? GalleryImageUrl1 { get; set; }
    public string? GalleryImageUrl2 { get; set; }
    public string? GalleryImageUrl3 { get; set; }
    public PricingBreakdownDto PricingBreakdown { get; set; } = null!;
    public TripCompletionRequestDto? LatestCompletionRequest { get; set; }
}

public sealed record ApplyTripPromoCodeRequest(string PromoCode);
