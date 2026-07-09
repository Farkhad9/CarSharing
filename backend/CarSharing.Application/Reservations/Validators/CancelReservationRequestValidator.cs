using CarSharing.Application.Reservations.Dtos;
using FluentValidation;

namespace CarSharing.Application.Reservations.Validators;

public class CancelReservationRequestValidator : AbstractValidator<CancelReservationRequest>
{
    public CancelReservationRequestValidator()
    {
        RuleFor(request => request.Reason)
            .MaximumLength(500)
            .WithMessage("Cancel reason must be 500 characters or fewer.");
    }
}
