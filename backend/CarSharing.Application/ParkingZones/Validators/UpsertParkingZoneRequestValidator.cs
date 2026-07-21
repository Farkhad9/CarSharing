using FluentValidation;
using CarSharing.Application.ParkingZones.Dtos;

namespace CarSharing.Application.ParkingZones.Validators;

public sealed class UpsertParkingZoneRequestValidator : AbstractValidator<UpsertParkingZoneRequest>
{
    public UpsertParkingZoneRequestValidator()
    {
        RuleFor(request => request.Name)
            .NotEmpty()
            .MaximumLength(150);

        RuleFor(request => request.Type)
            .IsInEnum();

        RuleFor(request => request.Boundary)
            .NotNull()
            .Must(points => points.Count >= 3)
            .WithMessage("Parking zone must have at least 3 map points.");

        RuleForEach(request => request.Boundary)
            .ChildRules(point =>
            {
                point.RuleFor(value => value.Latitude)
                    .InclusiveBetween(-90, 90)
                    .WithMessage("Latitude must be between -90 and 90.");

                point.RuleFor(value => value.Longitude)
                    .InclusiveBetween(-180, 180)
                    .WithMessage("Longitude must be between -180 and 180.");
            });
    }
}
