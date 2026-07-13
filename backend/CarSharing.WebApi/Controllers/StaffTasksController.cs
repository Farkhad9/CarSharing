using CarSharing.Application.Common.Models;
using CarSharing.Application.StaffTasks.Dtos;
using CarSharing.Application.StaffTasks.Services;
using CarSharing.WebApi.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.StaffOrAdmin)]
[Route("api/staff/tasks")]
public sealed class StaffTasksController : ControllerBase
{
    private readonly IStaffTaskService _staffTaskService;

    public StaffTasksController(IStaffTaskService staffTaskService)
    {
        _staffTaskService = staffTaskService;
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyTasks(CancellationToken cancellationToken)
    {
        var result = await _staffTaskService.GetMyTasksAsync(cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        UpdateStaffTaskStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _staffTaskService.UpdateStatusAsync(id, request, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code == "StaffTask.Unauthenticated"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code is "StaffTask.StaffRequired" or "StaffTask.Forbidden"))
        {
            return Forbid();
        }

        if (errors.Any(error => error.Code == "StaffTask.NotFound"))
        {
            return NotFound(new { errors });
        }

        return BadRequest(new { errors });
    }
}
