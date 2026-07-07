namespace CarSharing.Application.Vehicles.Dtos;

public interface IVehicleDetailsRequest
{
    string Brand { get; }
    string Model { get; }
    int Year { get; }
    string PlateNumber { get; }
    double MileageKm { get; }
    int BatteryPercent { get; }
    int RangeKm { get; }
    decimal PricePerMinute { get; }
    string Currency { get; }
    int Seats { get; }
    string Color { get; }
    string ConnectorType { get; }
    string LocationLabel { get; }
    string Zone { get; }
    double Latitude { get; }
    double Longitude { get; }
}
