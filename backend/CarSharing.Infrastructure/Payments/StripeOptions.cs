namespace CarSharing.Infrastructure.Payments;

public sealed class StripeOptions
{
    public const string SectionName = "Stripe";
    public string SecretKey { get; init; } = string.Empty;
    public string WebhookSecret { get; init; } = string.Empty;
    public string SuccessUrl { get; init; } = "http://localhost:5173/dashboard?tab=payments&stripe=success";
    public string CancelUrl { get; init; } = "http://localhost:5173/dashboard?tab=payments&stripe=cancelled";
}
