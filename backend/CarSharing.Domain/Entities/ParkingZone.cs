using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class ParkingZone : BaseEntity
{
    private ParkingZone()
    {
    }

    public string Name { get; private set; } = null!;
    public ParkingZoneType Type { get; private set; } = ParkingZoneType.Parking;
    public double CenterLatitude { get; private set; }
    public double CenterLongitude { get; private set; }
    public double RadiusInMeters { get; private set; }
    public string BoundaryJson { get; private set; } = "[]";
    public bool AllowsTripEnd { get; private set; } = true;
    public bool IsActive { get; private set; } = true;

    public static ParkingZone Create(
        string name,
        ParkingZoneType type,
        double centerLatitude,
        double centerLongitude,
        double radiusInMeters,
        string boundaryJson,
        bool allowsTripEnd)
    {
        return new ParkingZone
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            Type = type,
            CenterLatitude = centerLatitude,
            CenterLongitude = centerLongitude,
            RadiusInMeters = radiusInMeters,
            BoundaryJson = boundaryJson,
            AllowsTripEnd = allowsTripEnd,
            IsActive = true
        };
    }

    public void Update(
        string name,
        ParkingZoneType type,
        double centerLatitude,
        double centerLongitude,
        double radiusInMeters,
        string boundaryJson,
        bool allowsTripEnd,
        bool isActive)
    {
        Name = name.Trim();
        Type = type;
        CenterLatitude = centerLatitude;
        CenterLongitude = centerLongitude;
        RadiusInMeters = radiusInMeters;
        BoundaryJson = boundaryJson;
        AllowsTripEnd = allowsTripEnd;
        IsActive = isActive;
    }

    public void Deactivate()
    {
        IsActive = false;
    }
}
