using CarSharing.Domain.Enums;

namespace CarSharing.Application.Vehicles.Dtos;

public class UpdateVehicleStatusRequest
{
    public VehicleStatus Status { get; set; }
}
