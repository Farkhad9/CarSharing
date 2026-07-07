using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class Vehicle : BaseEntity
{
    private Vehicle()
    {
    }

    public string Brand { get; private set; } = null!;
    public string Model { get; private set; } = null!;
    public int Year { get; private set; }
    public string PlateNumber { get; private set; } = null!;
    public double MileageKm { get; private set; }
    public int BatteryPercent { get; private set; }
    public int RangeKm { get; private set; }
    public decimal PricePerMinute { get; private set; }
    public string Currency { get; private set; } = "AZN";
    public VehicleStatus Status { get; private set; } = VehicleStatus.Available;
    public int Seats { get; private set; }
    public string Color { get; private set; } = null!;
    public string ConnectorType { get; private set; } = null!;
    public Guid? ChargingStationId { get; private set; }
    public string LocationLabel { get; private set; } = null!;
    public string Zone { get; private set; } = null!;
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }

    public static Vehicle Create(
        string brand,
        string model,
        int year,
        string plateNumber,
        double mileageKm,
        int batteryPercent,
        int rangeKm,
        decimal pricePerMinute,
        string currency,
        int seats,
        string color,
        string connectorType,
        Guid? chargingStationId,
        string locationLabel,
        string zone,
        double latitude,
        double longitude)
    {
        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid()
        };

        vehicle.UpdateDetails(
            brand,
            model,
            year,
            plateNumber,
            mileageKm,
            batteryPercent,
            rangeKm,
            pricePerMinute,
            currency,
            seats,
            color,
            connectorType,
            chargingStationId,
            locationLabel,
            zone,
            latitude,
            longitude);

        vehicle.Status = VehicleStatus.Available;

        return vehicle;
    }

    public void UpdateDetails(
        string brand,
        string model,
        int year,
        string plateNumber,
        double mileageKm,
        int batteryPercent,
        int rangeKm,
        decimal pricePerMinute,
        string currency,
        int seats,
        string color,
        string connectorType,
        Guid? chargingStationId,
        string locationLabel,
        string zone,
        double latitude,
        double longitude)
    {
        Brand = brand.Trim();
        Model = model.Trim();
        Year = year;
        PlateNumber = plateNumber.Trim().ToUpperInvariant();
        MileageKm = mileageKm;
        BatteryPercent = batteryPercent;
        RangeKm = rangeKm;
        PricePerMinute = pricePerMinute;
        Currency = currency.Trim().ToUpperInvariant();
        Seats = seats;
        Color = color.Trim();
        ConnectorType = connectorType.Trim();
        ChargingStationId = chargingStationId;
        LocationLabel = locationLabel.Trim();
        Zone = zone.Trim();
        Latitude = latitude;
        Longitude = longitude;
    }

    public void ChangeStatus(VehicleStatus status)
    {
        Status = status;
    }
}
