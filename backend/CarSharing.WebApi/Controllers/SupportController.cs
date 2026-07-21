using CarSharing.Application.Common.Models;
using CarSharing.Application.Support.Dtos;
using CarSharing.Application.Support.Services;
using CarSharing.Domain.Enums;
using CarSharing.WebApi.Auth;
using CarSharing.WebApi.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace CarSharing.WebApi.Controllers;

[ApiController]
public sealed class SupportController : ControllerBase
{
    private readonly ISupportService _supportService;
    private readonly IHubContext<SupportHub> _supportHub;

    public SupportController(ISupportService supportService, IHubContext<SupportHub> supportHub)
    {
        _supportService = supportService;
        _supportHub = supportHub;
    }

    [Authorize(Policy = AuthorizationPolicies.RiderOnly)]
    [HttpGet("api/support/tickets/my")]
    public async Task<IActionResult> GetMyTickets(CancellationToken cancellationToken)
    {
        var result = await _supportService.GetMyTicketsAsync(cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [Authorize(Policy = AuthorizationPolicies.RiderOnly)]
    [HttpPost("api/support/tickets")]
    public async Task<IActionResult> CreateTicket(CreateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await _supportService.CreateTicketAsync(request, cancellationToken);
        if (result.IsFailure) return ToErrorResponse(result.Errors);

        await BroadcastTicketAsync(result.Value!, cancellationToken);
        return Created(string.Empty, result.Value);
    }

    [Authorize]
    [HttpGet("api/support/tickets/{id:guid}")]
    public async Task<IActionResult> GetTicket(Guid id, CancellationToken cancellationToken)
    {
        var result = await _supportService.GetTicketAsync(id, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [Authorize]
    [HttpPost("api/support/tickets/{id:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, SendSupportMessageRequest request, CancellationToken cancellationToken)
    {
        var result = await _supportService.SendMessageAsync(id, request, cancellationToken);
        if (result.IsFailure) return ToErrorResponse(result.Errors);

        await BroadcastTicketAsync(result.Value!, cancellationToken);
        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost("api/support/tickets/{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id, CancellationToken cancellationToken)
    {
        var result = await _supportService.CloseAsync(id, cancellationToken);
        if (result.IsFailure) return ToErrorResponse(result.Errors);

        await BroadcastTicketAsync(result.Value!, cancellationToken);
        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost("api/support/tickets/{id:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid id, CancellationToken cancellationToken)
    {
        var result = await _supportService.ReopenAsync(id, cancellationToken);
        if (result.IsFailure) return ToErrorResponse(result.Errors);

        await BroadcastTicketAsync(result.Value!, cancellationToken);
        return Ok(result.Value);
    }

    [Authorize(Policy = AuthorizationPolicies.StaffOrAdmin)]
    [HttpGet("api/staff/support/tickets")]
    public async Task<IActionResult> GetStaffQueue(CancellationToken cancellationToken)
    {
        var result = await _supportService.GetStaffQueueAsync(cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [Authorize(Policy = AuthorizationPolicies.StaffOrAdmin)]
    [HttpPost("api/staff/support/tickets/{id:guid}/assign-me")]
    public async Task<IActionResult> AssignToMe(Guid id, CancellationToken cancellationToken)
    {
        var result = await _supportService.AssignToMeAsync(id, cancellationToken);
        if (result.IsFailure) return ToErrorResponse(result.Errors);

        await BroadcastTicketAsync(result.Value!, cancellationToken);
        return Ok(result.Value);
    }

    [Authorize(Policy = AuthorizationPolicies.StaffOrAdmin)]
    [HttpPost("api/staff/support/tickets/{id:guid}/escalate")]
    public async Task<IActionResult> EscalateToAdmin(Guid id, CancellationToken cancellationToken)
    {
        var result = await _supportService.EscalateToAdminAsync(id, cancellationToken);
        if (result.IsFailure) return ToErrorResponse(result.Errors);

        await BroadcastTicketAsync(result.Value!, cancellationToken);
        return Ok(result.Value);
    }

    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    [HttpGet("api/admin/support/tickets")]
    public async Task<IActionResult> GetAdminQueue(CancellationToken cancellationToken)
    {
        var result = await _supportService.GetAdminQueueAsync(cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    [HttpPatch("api/admin/support/tickets/{id:guid}/assignee")]
    public async Task<IActionResult> AssignStaff(Guid id, AssignSupportTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await _supportService.AssignStaffAsync(id, request, cancellationToken);
        if (result.IsFailure) return ToErrorResponse(result.Errors);

        await BroadcastTicketAsync(result.Value!, cancellationToken);
        return Ok(result.Value);
    }

    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    [HttpPatch("api/admin/support/tickets/{id:guid}/priority")]
    public async Task<IActionResult> UpdatePriority(Guid id, UpdateSupportTicketPriorityRequest request, CancellationToken cancellationToken)
    {
        var result = await _supportService.UpdatePriorityAsync(id, request, cancellationToken);
        if (result.IsFailure) return ToErrorResponse(result.Errors);

        await BroadcastTicketAsync(result.Value!, cancellationToken);
        return Ok(result.Value);
    }

    private async Task BroadcastTicketAsync(SupportTicketDto ticket, CancellationToken cancellationToken)
    {
        await _supportHub.Clients.Group(SupportHub.GetUserGroup(ticket.RiderId))
            .SendAsync("SupportTicketUpdated", ticket, cancellationToken);
        await _supportHub.Clients.Group(SupportHub.StaffGroup)
            .SendAsync("SupportTicketUpdated", ticket, cancellationToken);
        await _supportHub.Clients.Group(SupportHub.AdminsGroup)
            .SendAsync("SupportTicketUpdated", ticket, cancellationToken);
        await _supportHub.Clients.Group(SupportHub.AdminsGroup)
            .SendAsync("SupportQueueChanged", new { scope = "support" }, cancellationToken);

        if (ticket.Status == SupportTicketStatus.EscalatedToAdmin)
        {
            await _supportHub.Clients.Group(SupportHub.AdminsGroup)
                .SendAsync("SupportTicketEscalated", ticket, cancellationToken);
        }
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code == "Support.Unauthenticated"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code is "Support.Forbidden" or "Support.RiderRequired" or "Support.StaffRequired" or "Support.AdminRequired"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { errors });
        }

        if (errors.Any(error => error.Code is "Support.NotFound" or "Support.StaffNotFound"))
        {
            return NotFound(new { errors });
        }

        return BadRequest(new { errors });
    }
}
