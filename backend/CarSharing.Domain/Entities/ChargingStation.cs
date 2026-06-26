 using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class ChargingStation
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public ChargingStationStatus Status { get; set; } = ChargingStationStatus.Online;
    public string LocationLabel { get; set; } = null!;
    public string Zone { get; set; } = null!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int PowerKw { get; set; }
    public int TotalPorts { get; set; }
    public int AvailablePorts { get; set; }
    public List<string> ConnectorTypes { get; set; } = [];
}
