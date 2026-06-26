using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class Vehicle
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
    public string Currency { get; set; } = "AZN";
    public VehicleStatus Status { get; set; } = VehicleStatus.Available;
    public int Seats { get; set; }
    public string Color { get; set; } = null!;
    public string ConnectorType { get; set; } = null!;
    public Guid? ChargingStationId { get; set; }
    public string LocationLabel { get; set; } = null!;
    public string Zone { get; set; } = null!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}
