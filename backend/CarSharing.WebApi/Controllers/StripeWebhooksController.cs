using CarSharing.Application.Payments.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/webhooks/stripe")]
public sealed class StripeWebhooksController : ControllerBase
{
    private readonly IPaymentService _service;
    public StripeWebhooksController(IPaymentService service) => _service = service;

    [HttpPost]
    public async Task<IActionResult> Handle(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(cancellationToken);
        var signature = Request.Headers["Stripe-Signature"].ToString();

        try
        {
            var result = await _service.HandleStripeWebhookAsync(payload, signature, cancellationToken);
            return result.IsSuccess ? Ok(new { received = true }) : BadRequest(new { errors = result.Errors });
        }
        catch (InvalidDataException)
        {
            return BadRequest(new { error = "Invalid Stripe webhook signature or payload." });
        }
    }
}
