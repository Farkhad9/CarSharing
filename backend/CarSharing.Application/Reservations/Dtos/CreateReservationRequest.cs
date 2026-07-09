namespace CarSharing.Application.Reservations.Dtos;

public class CreateReservationRequest
{
    public Guid VehicleId { get; set; }
    public int PassengerCount { get; set; } = 1;
}
