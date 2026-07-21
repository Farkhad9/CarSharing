namespace CarSharing.Application.Reservations.Dtos;

public class CreateReservationRequest
{
    public Guid VehicleId { get; set; }
    public int PassengerCount { get; set; } = 1;
    public string DestinationLabel { get; set; } = null!;
    public double DestinationLatitude { get; set; }
    public double DestinationLongitude { get; set; }
}
