using CarSharing.Application.Common.Models;
using CarSharing.Application.Payments.Dtos;
using CarSharing.Application.Payments.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/payments")]
public sealed class PaymentsController : ControllerBase
{
    private readonly IPaymentService _service;
    public PaymentsController(IPaymentService service) => _service = service;

    [HttpGet("balance")]
    public async Task<IActionResult> GetBalance(CancellationToken cancellationToken)
        => ToResponse(await _service.GetBalanceAsync(cancellationToken));

    [HttpGet("my")]
    public async Task<IActionResult> GetMyTransactions(CancellationToken cancellationToken)
        => ToResponse(await _service.GetMyTransactionsAsync(cancellationToken));

    [HttpPost("top-up")]
    public async Task<IActionResult> TopUp(TopUpBalanceRequest request, CancellationToken cancellationToken)
        => ToResponse(await _service.CreateTopUpCheckoutAsync(request, cancellationToken));

    [HttpPost("trips/{tripId:guid}/pay")]
    public async Task<IActionResult> PayTrip(Guid tripId, CancellationToken cancellationToken)
        => ToResponse(await _service.PayTripAsync(tripId, cancellationToken));

    [HttpPost("trips/{tripId:guid}/checkout")]
    public async Task<IActionResult> CreateTripCheckout(Guid tripId, CancellationToken cancellationToken)
        => ToResponse(await _service.CreateTripPaymentCheckoutAsync(tripId, cancellationToken));

    private IActionResult ToResponse<T>(Result<T> result)
    {
        if (result.IsSuccess) return Ok(result.Value);
        var errors = result.Errors;
        if (errors.Any(x => x.Code.StartsWith("Validation."))) return BadRequest(new { errors });
        if (errors.Any(x => x.Code == "Payment.Unauthenticated")) return Unauthorized(new { errors });
        if (errors.Any(x => x.Code == "Payment.Forbidden")) return Forbid();
        if (errors.Any(x => x.Code is "Payment.UserNotFound" or "Payment.TripNotFound" or "Payment.VehicleNotFound"))
            return NotFound(new { errors });
        if (errors.Any(x => x.Code is "Payment.InsufficientBalance" or "Payment.AlreadyPaid" or "Payment.TripNotAwaitingPayment"))
            return Conflict(new { errors });
        if (errors.Any(x => x.Code == "Payment.GatewayUnavailable"))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { errors });
        return BadRequest(new { errors });
    }
}
