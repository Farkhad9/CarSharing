using CarSharing.Application.Common.Models;
using CarSharing.Application.StaffTasks.Dtos;
using CarSharing.Application.StaffTasks.Services;
using CarSharing.WebApi.Auth;
using CarSharing.WebApi.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Route("api/admin/staff/tasks")]
public sealed class AdminStaffTasksController : ControllerBase
{
    private readonly IStaffTaskService _staffTaskService;
    private readonly IHubContext<OperationsHub> _operationsHub;

    public AdminStaffTasksController(
        IStaffTaskService staffTaskService,
        IHubContext<OperationsHub> operationsHub)
    {
        _staffTaskService = staffTaskService;
        _operationsHub = operationsHub;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var result = await _staffTaskService.GetAllTasksAsync(cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        CreateStaffTaskRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _staffTaskService.CreateAsync(request, cancellationToken);
        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        var task = result.Value!;
        await BroadcastStaffTaskAsync("StaffTaskCreated", task, cancellationToken);
        return Created(string.Empty, task);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        UpdateStaffTaskStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _staffTaskService.UpdateStatusAsync(id, request, cancellationToken);
        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        var task = result.Value!;
        await BroadcastStaffTaskAsync("StaffTaskUpdated", task, cancellationToken);
        return Ok(task);
    }

    private async Task BroadcastStaffTaskAsync(string eventName, StaffTaskDto task, CancellationToken cancellationToken)
    {
        await _operationsHub.Clients.Group(OperationsHub.AdminsGroup)
            .SendAsync(eventName, task, cancellationToken);
        await _operationsHub.Clients.Group(OperationsHub.GetStaffGroup(task.AssigneeId))
            .SendAsync(eventName, task, cancellationToken);
        await _operationsHub.Clients.Group(OperationsHub.AdminsGroup)
            .SendAsync("AdminDataChanged", new { scope = "staffTasks" }, cancellationToken);
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code.StartsWith("Validation.")))
        {
            return BadRequest(new { errors });
        }

        if (errors.Any(error => error.Code == "StaffTask.Unauthenticated"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code is "StaffTask.AdminRequired" or "StaffTask.StaffRequired" or "StaffTask.Forbidden"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { errors });
        }

        if (errors.Any(error => error.Code is "StaffTask.NotFound" or "StaffTask.AssigneeNotFound"))
        {
            return NotFound(new { errors });
        }

        return BadRequest(new { errors });
    }
}
