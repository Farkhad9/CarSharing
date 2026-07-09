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
    }
}
