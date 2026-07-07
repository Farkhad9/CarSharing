using CarSharing.Application.Vehicles.Dtos;
using FluentValidation;

namespace CarSharing.Application.Vehicles.Validators;

public class UpdateVehicleRequestValidator : AbstractValidator<UpdateVehicleRequest>
{
    public UpdateVehicleRequestValidator()
    {
        Include(new VehicleRequestValidator<UpdateVehicleRequest>());
    }
}
