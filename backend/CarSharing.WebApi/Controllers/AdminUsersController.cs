using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Admin.Services;
using CarSharing.Application.Common.Models;
using CarSharing.WebApi.Auth;
using CarSharing.WebApi.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Route("api/admin/users")]
public sealed class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;
    private readonly IHubContext<OperationsHub> _operationsHub;

    public AdminUsersController(
        IAdminUserService adminUserService,
        IHubContext<OperationsHub> operationsHub)
    {
        _adminUserService = adminUserService;
        _operationsHub = operationsHub;
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
        var result = await _adminUserService.CreateStaffAsync(request, cancellationToken);
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
        var result = await _adminUserService.CreateAdminAsync(request, cancellationToken);
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

        if (errors.Any(error => error.Code == "AdminUsers.EmailNotUnique"))
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
}
