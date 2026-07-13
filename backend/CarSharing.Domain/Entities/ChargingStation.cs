using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class ChargingStation : BaseEntity
{
    private ChargingStation()
    {
    }

    public string Name { get; private set; } = null!;
    public ChargingStationStatus Status { get; private set; } = ChargingStationStatus.Online;
    public string LocationLabel { get; private set; } = null!;
    public string Zone { get; private set; } = null!;
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }
    public int PowerKw { get; private set; }
    public int TotalPorts { get; private set; }
    public int AvailablePorts { get; private set; }
    public string ConnectorTypes { get; private set; } = null!;

    public static ChargingStation Create(
        string name,
        ChargingStationStatus status,
        string locationLabel,
        string zone,
        double latitude,
        double longitude,
        int powerKw,
        int totalPorts,
        int availablePorts,
        IEnumerable<string> connectorTypes)
    {
        if (availablePorts > totalPorts)
        {
            throw new ArgumentException("Available ports cannot exceed total ports.", nameof(availablePorts));
        }

        return new ChargingStation
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            Status = status,
            LocationLabel = locationLabel.Trim(),
            Zone = zone.Trim(),
            Latitude = latitude,
            Longitude = longitude,
            PowerKw = powerKw,
            TotalPorts = totalPorts,
            AvailablePorts = Math.Max(0, availablePorts),
            ConnectorTypes = string.Join(",", connectorTypes.Select(type => type.Trim()).Where(type => type.Length > 0))
        };
    }

    public IReadOnlyList<string> GetConnectorTypes()
    {
        return ConnectorTypes
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
    }

    public bool CanStartCharging(string connectorType)
    {
        return Status == ChargingStationStatus.Online
            && AvailablePorts > 0
            && GetConnectorTypes().Any(type => type.Equals(connectorType, StringComparison.OrdinalIgnoreCase));
    }

    public void OccupyPort()
    {
        if (Status != ChargingStationStatus.Online || AvailablePorts <= 0)
        {
            throw new InvalidOperationException("Charging station has no available ports.");
        }

        AvailablePorts--;
        if (AvailablePorts == 0)
        {
            Status = ChargingStationStatus.Busy;
        }
    }

    public void ReleasePort()
    {
        AvailablePorts = Math.Min(TotalPorts, AvailablePorts + 1);
        if (Status == ChargingStationStatus.Busy && AvailablePorts > 0)
        {
            Status = ChargingStationStatus.Online;
        }
    }

    public void ChangeStatus(ChargingStationStatus status)
    {
        Status = status;
        if (status is ChargingStationStatus.Maintenance or ChargingStationStatus.Offline)
        {
            AvailablePorts = 0;
        }
    }
}
