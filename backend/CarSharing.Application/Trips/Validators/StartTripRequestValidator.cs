using CarSharing.Application.Trips.Dtos;
using FluentValidation;

namespace CarSharing.Application.Trips.Validators;

public class StartTripRequestValidator : AbstractValidator<StartTripRequest>
{
    public StartTripRequestValidator()
    {
        RuleFor(request => request.ReservationId)
            .NotEmpty();
    }
}
