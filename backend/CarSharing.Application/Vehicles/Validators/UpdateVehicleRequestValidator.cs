using CarSharing.Application.Vehicles.Dtos;
using FluentValidation;

namespace CarSharing.Application.Vehicles.Validators;

public class UpdateVehicleRequestValidator : AbstractValidator<UpdateVehicleRequest>
{
    public UpdateVehicleRequestValidator()
    {
        Include(new VehicleRequestValidator<UpdateVehicleRequest>());

        RuleFor(x => x.Status)
            .IsInEnum()
            .WithMessage("Vehicle status is not valid.");
    }
}
