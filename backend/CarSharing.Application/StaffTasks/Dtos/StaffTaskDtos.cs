using CarSharing.Domain.Enums;

namespace CarSharing.Application.StaffTasks.Dtos;

public sealed record StaffTaskDto(
    Guid Id,
    string Title,
    string Description,
    Guid AssigneeId,
    Guid? VehicleId,
    StaffTaskPriority Priority,
    DateTime? DueAt,
    StaffTaskStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateStaffTaskRequest(
    string Title,
    string Description,
    Guid AssigneeId,
    Guid? VehicleId,
    StaffTaskPriority Priority,
    DateTime? DueAt);

public sealed record UpdateStaffTaskStatusRequest(StaffTaskStatus Status);

public sealed record ReassignStaffTaskRequest(Guid AssigneeId);

public sealed record ReassignStaffTaskResult(StaffTaskDto Task, Guid PreviousAssigneeId);
