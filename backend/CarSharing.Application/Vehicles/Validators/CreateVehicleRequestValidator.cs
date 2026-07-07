using CarSharing.Application.Vehicles.Dtos;
using FluentValidation;

namespace CarSharing.Application.Vehicles.Validators;

public class CreateVehicleRequestValidator : AbstractValidator<CreateVehicleRequest>
{
    public CreateVehicleRequestValidator()
    {
        Include(new VehicleRequestValidator<CreateVehicleRequest>());
    }
}
