using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class ParkingZone
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public ParkingZoneType Type { get; set; } = ParkingZoneType.Parking;
    public double CenterLatitude { get; set; }
    public double CenterLongitude { get; set; }
    public double RadiusInMeters { get; set; }
    public bool AllowsTripEnd { get; set; } = true;
    public bool IsActive { get; set; } = true;
}
