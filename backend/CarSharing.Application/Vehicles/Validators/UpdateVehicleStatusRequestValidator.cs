using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Domain.Enums;
using FluentValidation;

namespace CarSharing.Application.Vehicles.Validators;

public class UpdateVehicleStatusRequestValidator : AbstractValidator<UpdateVehicleStatusRequest>
{
    public UpdateVehicleStatusRequestValidator()
    {
        RuleFor(x => x.Status)
            .IsInEnum()
            .NotEqual((VehicleStatus)0)
            .WithMessage("Vehicle status is not valid.");
    }
}
