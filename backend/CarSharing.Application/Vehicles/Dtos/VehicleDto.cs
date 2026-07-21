using CarSharing.Domain.Enums;

namespace CarSharing.Application.Vehicles.Dtos;

public class VehicleDto
{
    public Guid Id { get; set; }
    public string Brand { get; set; } = null!;
    public string Model { get; set; } = null!;
    public int Year { get; set; }
    public string PlateNumber { get; set; } = null!;
    public double MileageKm { get; set; }
    public int BatteryPercent { get; set; }
    public int RangeKm { get; set; }
    public decimal PricePerMinute { get; set; }
    public decimal ActivePricePerMinute { get; set; }
    public decimal DemandMultiplier { get; set; }
    public decimal ZoneMultiplier { get; set; }
    public decimal BatteryMultiplier { get; set; }
    public decimal PricingAdjustmentAmount { get; set; }
    public string PricingMode { get; set; } = "Standard";
    public string Currency { get; set; } = null!;
    public VehicleStatus Status { get; set; }
    public int Seats { get; set; }
    public string Color { get; set; } = null!;
    public string ConnectorType { get; set; } = null!;
    public string? MainImageUrl { get; set; }
    public string? GalleryImageUrl1 { get; set; }
    public string? GalleryImageUrl2 { get; set; }
    public string? GalleryImageUrl3 { get; set; }
    public Guid? ChargingStationId { get; set; }
    public DateTime? ActiveTripStartedAt { get; set; }
    public string LocationLabel { get; set; } = null!;
    public string Zone { get; set; } = null!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}
