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
                    .InclusiveBetween(40.2, 40.6);

                point.RuleFor(value => value.Longitude)
                    .InclusiveBetween(49.55, 50.25);
            });
    }
}
