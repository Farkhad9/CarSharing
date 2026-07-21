using CarSharing.Application.Common.Models;
using CarSharing.Application.Pricing.Dtos;
using CarSharing.Application.Pricing.Services;
using CarSharing.WebApi.Auth;
using CarSharing.WebApi.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Route("api/admin/pricing")]
public sealed class AdminPricingController : ControllerBase
{
    private readonly IPricingPolicyService _pricingPolicyService;
    private readonly IHubContext<OperationsHub> _operationsHub;

    public AdminPricingController(
        IPricingPolicyService pricingPolicyService,
        IHubContext<OperationsHub> operationsHub)
    {
        _pricingPolicyService = pricingPolicyService;
        _operationsHub = operationsHub;
    }

    [HttpGet("current")]
    public async Task<IActionResult> GetCurrent(CancellationToken cancellationToken)
    {
        var result = await _pricingPolicyService.GetCurrentAsync(cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPatch("mode")]
    public async Task<IActionResult> UpdateMode(
        UpdatePricingModeRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _pricingPolicyService.UpdateModeAsync(request, cancellationToken);
        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        await _operationsHub.Clients.Group(OperationsHub.AdminsGroup)
            .SendAsync("AdminDataChanged", new { scope = "pricing" }, cancellationToken);

        await _operationsHub.Clients.Group(OperationsHub.AdminsGroup)
            .SendAsync("AdminDataChanged", new { scope = "vehicles" }, cancellationToken);

        return Ok(result.Value);
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code == "Pricing.Unauthenticated"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code == "Pricing.AdminRequired"))
        {
            return Forbid();
        }

        return BadRequest(new { errors });
    }
}
