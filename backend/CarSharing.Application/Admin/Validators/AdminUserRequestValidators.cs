using CarSharing.Application.Admin.Dtos;
using CarSharing.Domain.Enums;
using FluentValidation;

namespace CarSharing.Application.Admin.Validators;

public sealed class CreateStaffUserRequestValidator : AbstractValidator<CreateStaffUserRequest>
{
    public CreateStaffUserRequestValidator()
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
            .Matches(@"^[A-Za-z0-9]{5,20}$")
            .WithMessage("Driver license number can contain only letters and digits.");
    }
}

public sealed class CreateAdminUserRequestValidator : AbstractValidator<CreateAdminUserRequest>
{
    public CreateAdminUserRequestValidator()
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
            .Matches(@"^[A-Za-z0-9]{5,20}$")
            .WithMessage("Driver license number can contain only letters and digits.");

        RuleFor(x => x.Role)
            .Must(role => role is UserRole.Admin or UserRole.SuperAdmin)
            .WithMessage("Only Admin or SuperAdmin accounts can be created from this endpoint.");
    }
}

public sealed class UpdateUserRoleRequestValidator : AbstractValidator<UpdateUserRoleRequest>
{
    public UpdateUserRoleRequestValidator()
    {
        RuleFor(x => x.Role)
            .Must(role => role is UserRole.Staff or UserRole.Admin or UserRole.SuperAdmin)
            .WithMessage("Role must be Staff, Admin, or SuperAdmin.");
    }
}

public sealed class UpdateUserVerificationRequestValidator : AbstractValidator<UpdateUserVerificationRequest>
{
    public UpdateUserVerificationRequestValidator()
    {
        RuleFor(x => x.Status)
            .Must(status => status is UserVerificationStatus.Verified or UserVerificationStatus.Rejected)
            .WithMessage("Verification status must be Verified or Rejected.");
    }
}
