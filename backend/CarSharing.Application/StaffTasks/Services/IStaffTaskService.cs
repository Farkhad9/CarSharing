using CarSharing.Application.Common.Models;
using CarSharing.Application.StaffTasks.Dtos;

namespace CarSharing.Application.StaffTasks.Services;

public interface IStaffTaskService
{
    Task<Result<IReadOnlyList<StaffTaskDto>>> GetAllTasksAsync(CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<StaffTaskDto>>> GetMyTasksAsync(CancellationToken cancellationToken = default);
    Task<Result<StaffTaskDto>> CreateAsync(CreateStaffTaskRequest request, CancellationToken cancellationToken = default);
    Task<Result<StaffTaskDto>> UpdateStatusAsync(Guid taskId, UpdateStaffTaskStatusRequest request, CancellationToken cancellationToken = default);
}
