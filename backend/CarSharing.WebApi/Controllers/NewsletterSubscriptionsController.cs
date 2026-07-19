using System.ComponentModel.DataAnnotations;
using CarSharing.Domain.Entities;
using CarSharing.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/newsletter/subscriptions")]
public sealed class NewsletterSubscriptionsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public NewsletterSubscriptionsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpPost]
    public async Task<IActionResult> Subscribe(NewsletterSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email?.Trim() ?? "";
        if (!new EmailAddressAttribute().IsValid(email))
        {
            return BadRequest(new { error = "Enter a valid email address." });
        }

        var normalizedEmail = NewsletterSubscription.NormalizeEmail(email);
        var existing = await _dbContext.NewsletterSubscriptions
            .FirstOrDefaultAsync(subscription => subscription.Email == normalizedEmail, cancellationToken);

        if (existing is null)
        {
            _dbContext.NewsletterSubscriptions.Add(NewsletterSubscription.Create(email, DateTime.UtcNow));
        }
        else
        {
            existing.Reactivate(DateTime.UtcNow);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new NewsletterSubscriptionResponse(normalizedEmail, "Subscription saved."));
    }

    public sealed record NewsletterSubscriptionRequest(string Email);
    private sealed record NewsletterSubscriptionResponse(string Email, string Message);
}
