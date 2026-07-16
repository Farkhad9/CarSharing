using CarSharing.Application.Users.Dtos;
using FluentValidation;

namespace CarSharing.Application.Users.Validators;

public class RegisterUserRequestValidator : AbstractValidator<RegisterUserRequest>
{
    public RegisterUserRequestValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty()
            .WithMessage("First name is required.")
            .Matches(@"^[\p{L}]+(?:[ '-][\p{L}]+)*$")
            .WithMessage("First name can contain only letters.");

        RuleFor(x => x.LastName)
            .NotEmpty()
            .WithMessage("Last name is required.")
            .Matches(@"^[\p{L}]+(?:[ '-][\p{L}]+)*$")
            .WithMessage("Last name can contain only letters.");

        RuleFor(x => x.Email)
            .NotEmpty()
            .WithMessage("Email is required.")
            .EmailAddress()
            .WithMessage("Email is not valid.");

        RuleFor(x => x.Phone)
            .NotEmpty()
            .WithMessage("Phone is required.")
            .Matches(@"^(\+994|994|0)\d{9}$")
            .WithMessage("Phone number must be a valid Azerbaijan number.");

        RuleFor(x => x.Password)
            .NotEmpty()
            .WithMessage("Password is required.")
            .MinimumLength(8)
            .WithMessage("Password must contain at least 8 characters.")
            .Matches(@"[A-Z]")
            .WithMessage("Password must contain at least one uppercase letter.")
            .Matches(@"[a-z]")
            .WithMessage("Password must contain at least one lowercase letter.")
            .Matches(@"\d")
            .WithMessage("Password must contain at least one digit.")
            .Matches(@"[^a-zA-Z0-9]")
            .WithMessage("Password must contain at least one special character.");

        RuleFor(x => x.DriverLicenseNumber)
            .NotEmpty()
            .WithMessage("Driver license number is required.")
            .Matches(@"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9-]{5,20}$")
            .WithMessage("Driver license number must contain letters and digits.");
    }
}
