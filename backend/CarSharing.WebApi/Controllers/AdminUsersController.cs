using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Admin.Services;
using CarSharing.Application.Common.Models;
using CarSharing.WebApi.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Route("api/admin/users")]
public sealed class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;

    public AdminUsersController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
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
        return result.IsFailure
            ? ToErrorResponse(result.Errors)
            : CreatedAtAction(nameof(GetUser), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPost("admin")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdminOnly)]
    public async Task<IActionResult> CreateAdmin(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.CreateAdminAsync(request, cancellationToken);
        return result.IsFailure
            ? ToErrorResponse(result.Errors)
            : CreatedAtAction(nameof(GetUser), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPatch("{id:guid}/role")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdminOnly)]
    public async Task<IActionResult> UpdateRole(
        Guid id,
        UpdateUserRoleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.UpdateRoleAsync(id, request, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        UpdateUserStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.UpdateStatusAsync(id, request, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPatch("{id:guid}/verification")]
    public async Task<IActionResult> UpdateVerification(
        Guid id,
        UpdateUserVerificationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _adminUserService.UpdateVerificationAsync(id, request, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
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

        if (errors.Any(error => error.Code is "AdminUsers.AdminRequired" or "AdminUsers.SuperAdminRequired" or "AdminUsers.CannotManageSuperAdmin"))
        {
            return Forbid();
        }

        return BadRequest(new { errors });
    }
}
