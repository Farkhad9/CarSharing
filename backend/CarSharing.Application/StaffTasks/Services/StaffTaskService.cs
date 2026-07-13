using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.StaffTasks.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.StaffTasks.Services;

public sealed class StaffTaskService : IStaffTaskService
{
    private static readonly Error Unauthenticated = new("StaffTask.Unauthenticated", "User must be authenticated.");
    private static readonly Error StaffRequired = new("StaffTask.StaffRequired", "Only staff, admin, or super admin can manage staff tasks.");
    private static readonly Error TaskNotFound = new("StaffTask.NotFound", "Staff task was not found.");
    private static readonly Error Forbidden = new("StaffTask.Forbidden", "User is not allowed to update this task.");

    private readonly IStaffTaskRepository _staffTaskRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;

    public StaffTaskService(
        IStaffTaskRepository staffTaskRepository,
        ICurrentUserService currentUser,
        IUnitOfWork unitOfWork)
    {
        _staffTaskRepository = staffTaskRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<StaffTaskDto>>> GetMyTasksAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireStaffOrAdmin();
        if (accessError is not null) return Result<IReadOnlyList<StaffTaskDto>>.Failure(accessError);

        var tasks = await _staffTaskRepository.GetByAssigneeIdAsync(_currentUser.UserId!.Value, cancellationToken);
        return Result<IReadOnlyList<StaffTaskDto>>.Success(tasks.Select(Map).ToList());
    }

    public async Task<Result<StaffTaskDto>> UpdateStatusAsync(Guid taskId, UpdateStaffTaskStatusRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireStaffOrAdmin();
        if (accessError is not null) return Result<StaffTaskDto>.Failure(accessError);

        var task = await _staffTaskRepository.GetByIdAsync(taskId, cancellationToken);
        if (task is null) return Result<StaffTaskDto>.Failure(TaskNotFound);

        if (_currentUser.Role == UserRole.Staff && task.AssigneeId != _currentUser.UserId)
        {
            return Result<StaffTaskDto>.Failure(Forbidden);
        }

        task.ChangeStatus(request.Status, DateTime.UtcNow);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<StaffTaskDto>.Success(Map(task));
    }

    private Error? RequireStaffOrAdmin()
    {
        if (_currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role is UserRole.Staff or UserRole.Admin or UserRole.SuperAdmin ? null : StaffRequired;
    }

    private static StaffTaskDto Map(StaffTask task) => new(
        task.Id,
        task.Title,
        task.Description,
        task.AssigneeId,
        task.VehicleId,
        task.Priority,
        task.DueAt,
        task.Status,
        task.CreatedAt,
        task.UpdatedAt);
}
