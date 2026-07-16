using CarSharing.Application.StaffTasks.Dtos;
using FluentValidation;

namespace CarSharing.Application.StaffTasks.Validators;

public sealed class CreateStaffTaskRequestValidator : AbstractValidator<CreateStaffTaskRequest>
{
    public CreateStaffTaskRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty()
            .WithMessage("Task title is required.")
            .MaximumLength(150)
            .WithMessage("Task title must contain at most 150 characters.");

        RuleFor(x => x.Description)
            .NotEmpty()
            .WithMessage("Task description is required.")
            .MaximumLength(800)
            .WithMessage("Task description must contain at most 800 characters.");

        RuleFor(x => x.AssigneeId)
            .NotEmpty()
            .WithMessage("Task assignee is required.");

        RuleFor(x => x.Priority)
            .IsInEnum()
            .WithMessage("Task priority is not valid.");
    }
}
