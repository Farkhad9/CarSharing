using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.StaffTasks.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using FluentValidation;

namespace CarSharing.Application.StaffTasks.Services;

public sealed class StaffTaskService : IStaffTaskService
{
    private const int MinimumChargingCompletionBatteryPercent = 80;
    private const int ChargingPercentPerMinute = 10;

    private static readonly Error Unauthenticated = new("StaffTask.Unauthenticated", "User must be authenticated.");
    private static readonly Error StaffRequired = new("StaffTask.StaffRequired", "Only staff, admin, or super admin can manage staff tasks.");
    private static readonly Error AdminRequired = new("StaffTask.AdminRequired", "Only admin or super admin can manage all staff tasks.");
    private static readonly Error TaskNotFound = new("StaffTask.NotFound", "Staff task was not found.");
    private static readonly Error Forbidden = new("StaffTask.Forbidden", "User is not allowed to update this task.");
    private static readonly Error AssigneeNotFound = new("StaffTask.AssigneeNotFound", "Staff assignee was not found.");
    private static readonly Error AssigneeMustBeStaff = new("StaffTask.AssigneeMustBeStaff", "Task assignee must be an active staff user.");
    private static readonly Error ChargingTaskNotReady = new("StaffTask.ChargingNotReady", "Charging task can be done only from 80% battery.");

    private readonly IStaffTaskRepository _staffTaskRepository;
    private readonly IStaffKpiEventRepository _staffKpiEventRepository;
    private readonly IChargingSessionRepository _chargingSessionRepository;
    private readonly IUserRepository _userRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidator<CreateStaffTaskRequest> _createStaffTaskValidator;

    public StaffTaskService(
        IStaffTaskRepository staffTaskRepository,
        IStaffKpiEventRepository staffKpiEventRepository,
        IChargingSessionRepository chargingSessionRepository,
        IUserRepository userRepository,
        ICurrentUserService currentUser,
        IUnitOfWork unitOfWork,
        IValidator<CreateStaffTaskRequest> createStaffTaskValidator)
    {
        _staffTaskRepository = staffTaskRepository;
        _staffKpiEventRepository = staffKpiEventRepository;
        _chargingSessionRepository = chargingSessionRepository;
        _userRepository = userRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
        _createStaffTaskValidator = createStaffTaskValidator;
    }

    public async Task<Result<IReadOnlyList<StaffTaskDto>>> GetAllTasksAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<IReadOnlyList<StaffTaskDto>>.Failure(accessError);

        var tasks = await _staffTaskRepository.GetAllAsync(cancellationToken);
        return Result<IReadOnlyList<StaffTaskDto>>.Success(tasks.Select(Map).ToList());
    }

    public async Task<Result<IReadOnlyList<StaffTaskDto>>> GetMyTasksAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireStaffOrAdmin();
        if (accessError is not null) return Result<IReadOnlyList<StaffTaskDto>>.Failure(accessError);

        var tasks = await _staffTaskRepository.GetByAssigneeIdAsync(_currentUser.UserId!.Value, cancellationToken);
        return Result<IReadOnlyList<StaffTaskDto>>.Success(tasks.Select(Map).ToList());
    }

    public async Task<Result<StaffTaskDto>> CreateAsync(CreateStaffTaskRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<StaffTaskDto>.Failure(accessError);

        var validation = await _createStaffTaskValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return Result<StaffTaskDto>.Failure(ToValidationErrors(validation));
        }

        var assignee = await _userRepository.GetByIdAsync(request.AssigneeId, cancellationToken);
        if (assignee is null)
        {
            return Result<StaffTaskDto>.Failure(AssigneeNotFound);
        }

        if (assignee.Role != UserRole.Staff || !assignee.IsActive || assignee.IsBlocked(DateTime.UtcNow))
        {
            return Result<StaffTaskDto>.Failure(AssigneeMustBeStaff);
        }

        var task = StaffTask.Create(
            request.Title,
            request.Description,
            request.AssigneeId,
            request.VehicleId,
            request.Priority,
            request.DueAt,
            DateTime.UtcNow,
            request.Type);

        await _staffTaskRepository.AddAsync(task, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<StaffTaskDto>.Success(Map(task));
    }

    public async Task<Result<ReassignStaffTaskResult>> ReassignAsync(Guid taskId, ReassignStaffTaskRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<ReassignStaffTaskResult>.Failure(accessError);

        if (request.AssigneeId == Guid.Empty)
        {
            return Result<ReassignStaffTaskResult>.Failure(new Error("Validation.AssigneeId", "Assignee is required."));
        }

        var task = await _staffTaskRepository.GetByIdAsync(taskId, cancellationToken);
        if (task is null) return Result<ReassignStaffTaskResult>.Failure(TaskNotFound);

        var assignee = await _userRepository.GetByIdAsync(request.AssigneeId, cancellationToken);
        if (assignee is null)
        {
            return Result<ReassignStaffTaskResult>.Failure(AssigneeNotFound);
        }

        if (assignee.Role != UserRole.Staff || !assignee.IsActive || assignee.IsBlocked(DateTime.UtcNow))
        {
            return Result<ReassignStaffTaskResult>.Failure(AssigneeMustBeStaff);
        }

        var previousAssigneeId = task.AssigneeId;
        if (previousAssigneeId == request.AssigneeId)
        {
            return Result<ReassignStaffTaskResult>.Success(new ReassignStaffTaskResult(Map(task), previousAssigneeId));
        }

        var now = DateTime.UtcNow;
        task.Reassign(request.AssigneeId, now);

        var activeChargingSession = await _chargingSessionRepository.GetActiveByStaffTaskIdAsync(task.Id, cancellationToken);
        activeChargingSession?.ReassignStaff(request.AssigneeId);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ReassignStaffTaskResult>.Success(new ReassignStaffTaskResult(Map(task), previousAssigneeId));
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

        var previousStatus = task.Status;
        var now = DateTime.UtcNow;
        if (previousStatus != StaffTaskStatus.Done &&
            request.Status == StaffTaskStatus.Done &&
            task.Type == StaffTaskType.Charging)
        {
            var activeChargingSession = await _chargingSessionRepository.GetActiveByStaffTaskIdAsync(task.Id, cancellationToken);
            if (activeChargingSession is not null)
            {
                var currentBatteryPercent = CalculateChargingBatteryPercent(activeChargingSession, task, now);
                if (currentBatteryPercent < MinimumChargingCompletionBatteryPercent)
                {
                    return Result<StaffTaskDto>.Failure(ChargingTaskNotReady);
                }

                activeChargingSession.UpdateCurrentBattery(currentBatteryPercent);
            }
        }

        task.ChangeStatus(request.Status, now);
        if (previousStatus != StaffTaskStatus.Done && request.Status == StaffTaskStatus.Done)
        {
            var kpiEventExists = await _staffKpiEventRepository.ExistsAsync(task.AssigneeId, task.Id, cancellationToken);
            if (!kpiEventExists)
            {
                await _staffKpiEventRepository.AddAsync(
                    StaffKpiEvent.Create(
                        task.AssigneeId,
                        StaffKpiEventType.ServiceTaskCompleted,
                        task.Type,
                        task.Id,
                        task.Title,
                        task.Description,
                        now,
                        task.CreatedAt,
                        now),
                    cancellationToken);
            }
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<StaffTaskDto>.Success(Map(task));
    }

    private Error? RequireStaffOrAdmin()
    {
        if (_currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role is UserRole.Staff or UserRole.Admin or UserRole.SuperAdmin ? null : StaffRequired;
    }

    private Error? RequireAdmin()
    {
        if (_currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin ? null : AdminRequired;
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }

    private static int CalculateChargingBatteryPercent(ChargingSession session, StaffTask task, DateTime now)
    {
        if (task.Status != StaffTaskStatus.InProgress)
        {
            return session.CurrentBatteryPercent;
        }

        var elapsedMinutes = Math.Max(0, (now - task.UpdatedAt).TotalMinutes);
        return Math.Min(
            session.TargetBatteryPercent,
            Math.Max(
                session.CurrentBatteryPercent,
                (int)Math.Round(session.StartBatteryPercent + elapsedMinutes * ChargingPercentPerMinute)));
    }

    private static StaffTaskDto Map(StaffTask task) => new(
        task.Id,
        task.Title,
        task.Description,
        task.AssigneeId,
        task.VehicleId,
        task.Type,
        task.Priority,
        task.DueAt,
        task.Status,
        task.CreatedAt,
        task.UpdatedAt);
}
