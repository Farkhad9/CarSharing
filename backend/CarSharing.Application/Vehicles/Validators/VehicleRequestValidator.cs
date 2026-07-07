using CarSharing.Application.Vehicles.Dtos;
using FluentValidation;

namespace CarSharing.Application.Vehicles.Validators;

public class VehicleRequestValidator<T> : AbstractValidator<T>
    where T : IVehicleDetailsRequest
{
    public VehicleRequestValidator()
    {
        RuleFor(x => x.Brand)
            .NotEmpty()
            .MaximumLength(100)
            .WithMessage("Brand must not exceed 100 characters.");

        RuleFor(x => x.Model)
            .NotEmpty()
            .MaximumLength(100)
            .WithMessage("Model must not exceed 100 characters.");

        RuleFor(x => x.Year)
            .InclusiveBetween(2010, DateTime.UtcNow.Year + 1)
            .WithMessage("Year must be a valid vehicle model year.");

        RuleFor(x => x.PlateNumber)
            .NotEmpty()
            .Matches(@"^[A-Za-z0-9 -]{3,20}$")
            .WithMessage("Plate number can contain only letters, digits, spaces and hyphens.");

        RuleFor(x => x.MileageKm)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Mileage cannot be negative.");

        RuleFor(x => x.BatteryPercent)
            .InclusiveBetween(0, 100)
            .WithMessage("Battery percent must be between 0 and 100.");

        RuleFor(x => x.RangeKm)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Range cannot be negative.");

        RuleFor(x => x.PricePerMinute)
            .GreaterThan(0)
            .WithMessage("Price per minute must be greater than 0.");

        RuleFor(x => x.Currency)
            .NotEmpty()
            .Length(3)
            .WithMessage("Currency must be a 3-letter ISO code.");

        RuleFor(x => x.Seats)
            .InclusiveBetween(1, 9)
            .WithMessage("Seats must be between 1 and 9.");

        RuleFor(x => x.Color)
            .NotEmpty()
            .MaximumLength(50)
            .WithMessage("Color must not exceed 50 characters.");

        RuleFor(x => x.ConnectorType)
            .NotEmpty()
            .MaximumLength(50)
            .WithMessage("Connector type must not exceed 50 characters.");

        RuleFor(x => x.LocationLabel)
            .NotEmpty()
            .MaximumLength(200)
            .WithMessage("Location label must not exceed 200 characters.");

        RuleFor(x => x.Zone)
            .NotEmpty()
            .MaximumLength(100)
            .WithMessage("Zone must not exceed 100 characters.");

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90)
            .WithMessage("Latitude must be between -90 and 90.");

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180)
            .WithMessage("Longitude must be between -180 and 180.");
    }
}
