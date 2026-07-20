using CarSharing.Domain.Enums;

namespace CarSharing.Application.ParkingZones.Dtos;

public sealed record ParkingZonePointDto(double Latitude, double Longitude);

public sealed record ParkingZoneDto(
    Guid Id,
    string Name,
    ParkingZoneType Type,
    double CenterLatitude,
    double CenterLongitude,
    double RadiusInMeters,
    IReadOnlyList<ParkingZonePointDto> Boundary,
    bool AllowsTripEnd,
    bool IsActive);

public sealed class UpsertParkingZoneRequest
{
    public string Name { get; set; } = null!;
    public ParkingZoneType Type { get; set; } = ParkingZoneType.Parking;
    public IReadOnlyList<ParkingZonePointDto> Boundary { get; set; } = [];
    public bool AllowsTripEnd { get; set; } = true;
    public bool IsActive { get; set; } = true;
}
