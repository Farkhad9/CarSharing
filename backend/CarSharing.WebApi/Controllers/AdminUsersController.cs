using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Admin.Services;
using CarSharing.Application.Common.Models;
using CarSharing.WebApi.Auth;
using CarSharing.WebApi.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Route("api/admin/users")]
public sealed class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;
    private readonly IHubContext<OperationsHub> _operationsHub;
    private readonly ILogger<AdminUsersController> _logger;

    public AdminUsersController(
        IAdminUserService adminUserService,
        IHubContext<OperationsHub> operationsHub,
        ILogger<AdminUsersController> logger)
    {
        _adminUserService = adminUserService;
        _operationsHub = operationsHub;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers(
        [FromQuery] AdminUsersQuery query,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.GetUsersAsync(query, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await _adminUserService.GetUserAsync(id, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost("staff")]
    public async Task<IActionResult> CreateStaff(
        CreateStaffUserRequest request,
        CancellationToken cancellationToken)
    {
        Result<AdminUserDto> result;
        try
        {
            result = await _adminUserService.CreateStaffAsync(request, cancellationToken);
        }
        catch (DbUpdateException exception) when (TryMapUniqueUserConflict(exception, out var conflictError))
        {
            _logger.LogWarning(exception, "Staff creation hit a user uniqueness conflict.");
            return Conflict(new { errors = new[] { conflictError } });
        }

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        var user = result.Value!;
        await BroadcastUserChangedAsync(user, cancellationToken);
        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
    }

    [HttpPost("admin")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdminOnly)]
    public async Task<IActionResult> CreateAdmin(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken)
    {
        Result<AdminUserDto> result;
        try
        {
            result = await _adminUserService.CreateAdminAsync(request, cancellationToken);
        }
        catch (DbUpdateException exception) when (TryMapUniqueUserConflict(exception, out var conflictError))
        {
            _logger.LogWarning(exception, "Admin creation hit a user uniqueness conflict.");
            return Conflict(new { errors = new[] { conflictError } });
        }

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        var user = result.Value!;
        await BroadcastUserChangedAsync(user, cancellationToken);
        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
    }

    [HttpPatch("{id:guid}/role")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdminOnly)]
    public async Task<IActionResult> UpdateRole(
        Guid id,
        UpdateUserRoleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.UpdateRoleAsync(id, request, cancellationToken);
        return await ToUserChangeResponseAsync(result, cancellationToken);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        UpdateUserStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.UpdateStatusAsync(id, request, cancellationToken);
        return await ToUserChangeResponseAsync(result, cancellationToken);
    }

    [HttpPatch("{id:guid}/block")]
    public async Task<IActionResult> BlockUser(
        Guid id,
        BlockUserRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.BlockUserAsync(id, request, cancellationToken);
        return await ToUserChangeResponseAsync(result, cancellationToken);
    }

    [HttpPatch("{id:guid}/unblock")]
    public async Task<IActionResult> UnblockUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await _adminUserService.UnblockUserAsync(id, cancellationToken);
        return await ToUserChangeResponseAsync(result, cancellationToken);
    }

    [HttpPatch("{id:guid}/verification")]
    public async Task<IActionResult> UpdateVerification(
        Guid id,
        UpdateUserVerificationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.UpdateVerificationAsync(id, request, cancellationToken);
        return await ToUserChangeResponseAsync(result, cancellationToken);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdminOnly)]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await _adminUserService.DeleteUserAsync(id, cancellationToken);
        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        await BroadcastUsersChangedAsync(cancellationToken);
        return NoContent();
    }

    private async Task<IActionResult> ToUserChangeResponseAsync(
        Result<AdminUserDto> result,
        CancellationToken cancellationToken)
    {
        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        var user = result.Value!;
        await BroadcastUserChangedAsync(user, cancellationToken);
        return Ok(user);
    }

    private async Task BroadcastUserChangedAsync(AdminUserDto user, CancellationToken cancellationToken)
    {
        await _operationsHub.Clients.Group(OperationsHub.AdminsGroup)
            .SendAsync("AdminUserChanged", user, cancellationToken);
        await BroadcastUsersChangedAsync(cancellationToken);
    }

    private async Task BroadcastUsersChangedAsync(CancellationToken cancellationToken)
    {
        await _operationsHub.Clients.Group(OperationsHub.AdminsGroup)
            .SendAsync("AdminDataChanged", new { scope = "users" }, cancellationToken);
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code.StartsWith("Validation.")))
        {
            return BadRequest(new { errors });
        }

        if (errors.Any(error => error.Code == "AdminUsers.NotFound"))
        {
            return NotFound(new { errors });
        }

        if (errors.Any(error => error.Code is "AdminUsers.EmailNotUnique" or "AdminUsers.PhoneNotUnique" or "AdminUsers.DriverLicenseNotUnique"))
        {
            return Conflict(new { errors });
        }

        if (errors.Any(error => error.Code == "AdminUsers.Unauthenticated"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code is "AdminUsers.AdminRequired" or "AdminUsers.SuperAdminRequired" or "AdminUsers.CannotManageSuperAdmin" or "AdminUsers.CannotManageAdminAccount" or "AdminUsers.CannotChangeOwnRole"))
        {
            return Forbid();
        }

        return BadRequest(new { errors });
    }

    private static bool TryMapUniqueUserConflict(DbUpdateException exception, out Error error)
    {
        var message = exception.GetBaseException().Message;
        if (message.Contains("IX_Users_Email", StringComparison.OrdinalIgnoreCase))
        {
            error = new Error("AdminUsers.EmailNotUnique", "User with this email already exists.");
            return true;
        }

        if (message.Contains("IX_Users_Phone", StringComparison.OrdinalIgnoreCase))
        {
            error = new Error("AdminUsers.PhoneNotUnique", "User with this phone number already exists.");
            return true;
        }

        if (message.Contains("IX_Users_DriverLicenseNumber", StringComparison.OrdinalIgnoreCase))
        {
            error = new Error("AdminUsers.DriverLicenseNotUnique", "User with this driver license number already exists.");
            return true;
        }

        error = new Error("AdminUsers.NotUnique", "User already exists.");
        return false;
    }
}
