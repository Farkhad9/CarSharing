using CarSharing.Application.Reservations.Dtos;
using FluentValidation;

namespace CarSharing.Application.Reservations.Validators;

public class CreateReservationRequestValidator : AbstractValidator<CreateReservationRequest>
{
    public CreateReservationRequestValidator()
    {
        RuleFor(request => request.VehicleId)
            .NotEmpty()
            .WithMessage("Vehicle id is required.");

        RuleFor(request => request.PassengerCount)
            .InclusiveBetween(1, 9)
            .WithMessage("Passenger count must be between 1 and 9.");

        RuleFor(request => request.DestinationLabel)
            .NotEmpty()
            .MaximumLength(200)
            .WithMessage("Destination is required and must not exceed 200 characters.");

        RuleFor(request => request.DestinationLatitude)
            .InclusiveBetween(-90, 90)
            .WithMessage("Destination latitude must be between -90 and 90.");

        RuleFor(request => request.DestinationLongitude)
            .InclusiveBetween(-180, 180)
            .WithMessage("Destination longitude must be between -180 and 180.");
    }
}
