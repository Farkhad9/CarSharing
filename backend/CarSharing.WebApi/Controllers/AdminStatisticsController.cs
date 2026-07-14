using CarSharing.Application.Admin.Services;
using CarSharing.Application.Common.Models;
using CarSharing.WebApi.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Route("api/admin/statistics")]
public sealed class AdminStatisticsController : ControllerBase
{
    private readonly IAdminStatisticsService _statisticsService;

    public AdminStatisticsController(IAdminStatisticsService statisticsService)
    {
        _statisticsService = statisticsService;
    }

    [HttpGet("live")]
    public async Task<IActionResult> GetLive(CancellationToken cancellationToken)
    {
        var result = await _statisticsService.GetLiveStatisticsAsync(cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ToErrorResponse(result.Errors);
    }

    private static IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code == "AdminStatistics.Unauthenticated"))
        {
            return new UnauthorizedObjectResult(new { errors });
        }

        if (errors.Any(error => error.Code == "AdminStatistics.AdminRequired"))
        {
            return new ForbidResult();
        }

        return new BadRequestObjectResult(new { errors });
    }
}
