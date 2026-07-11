using CarSharing.Application.Trips.Dtos;
using FluentValidation;

namespace CarSharing.Application.Trips.Validators;

public class RejectTripCompletionRequestValidator : AbstractValidator<RejectTripCompletionRequest>
{
    public RejectTripCompletionRequestValidator()
    {
        RuleFor(request => request.Reason)
            .NotEmpty()
            .MaximumLength(500);
    }
}
