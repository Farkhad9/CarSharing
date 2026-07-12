using CarSharing.Application.Payments.Dtos;
using FluentValidation;

namespace CarSharing.Application.Payments.Validators;

public sealed class TopUpBalanceRequestValidator : AbstractValidator<TopUpBalanceRequest>
{
    public TopUpBalanceRequestValidator()
    {
        RuleFor(x => x.Amount).GreaterThanOrEqualTo(5).LessThanOrEqualTo(1000).PrecisionScale(18, 2, false);
    }
}
