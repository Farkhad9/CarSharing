using CarSharing.Application.Common.Interfaces;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;

namespace CarSharing.Infrastructure.Payments;

public sealed class StripePaymentGateway : IStripePaymentGateway
{
    private readonly StripeOptions _options;

    public StripePaymentGateway(IOptions<StripeOptions> options)
    {
        _options = options.Value;
    }

    public async Task<StripeCheckoutSession> CreateTopUpSessionAsync(Guid transactionId, Guid userId, string email,
        decimal amount, string currency, CancellationToken cancellationToken = default)
    {
        var client = CreateClient();
        var service = new SessionService(client);
        var session = await service.CreateAsync(new SessionCreateOptions
        {
            Mode = "payment",
            SuccessUrl = _options.SuccessUrl,
            CancelUrl = _options.CancelUrl,
            CustomerEmail = email,
            ClientReferenceId = transactionId.ToString(),
            Metadata = new Dictionary<string, string>
            {
                ["transactionId"] = transactionId.ToString(),
                ["userId"] = userId.ToString(),
                ["purpose"] = "balance_top_up"
            },
            LineItems =
            [
                new SessionLineItemOptions
                {
                    Quantity = 1,
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = currency.ToLowerInvariant(),
                        UnitAmount = decimal.ToInt64(decimal.Round(amount * 100, 0, MidpointRounding.AwayFromZero)),
                        ProductData = new SessionLineItemPriceDataProductDataOptions { Name = "ElectroStreet balance top-up" }
                    }
                }
            ]
        }, cancellationToken: cancellationToken);

        return new StripeCheckoutSession(session.Id, session.Url);
    }

    public async Task<StripeCheckoutSession> CreateTripPaymentSessionAsync(Guid transactionId, Guid userId, Guid tripId,
        string email, decimal amount, string currency, CancellationToken cancellationToken = default)
    {
        var client = CreateClient();
        var service = new SessionService(client);
        var session = await service.CreateAsync(new SessionCreateOptions
        {
            Mode = "payment",
            SuccessUrl = _options.SuccessUrl,
            CancelUrl = _options.CancelUrl,
            CustomerEmail = email,
            ClientReferenceId = transactionId.ToString(),
            Metadata = new Dictionary<string, string>
            {
                ["transactionId"] = transactionId.ToString(),
                ["userId"] = userId.ToString(),
                ["tripId"] = tripId.ToString(),
                ["purpose"] = "trip_payment"
            },
            LineItems =
            [
                new SessionLineItemOptions
                {
                    Quantity = 1,
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = currency.ToLowerInvariant(),
                        UnitAmount = decimal.ToInt64(decimal.Round(amount * 100, 0, MidpointRounding.AwayFromZero)),
                        ProductData = new SessionLineItemPriceDataProductDataOptions { Name = "ElectroStreet trip payment" }
                    }
                }
            ]
        }, cancellationToken: cancellationToken);

        return new StripeCheckoutSession(session.Id, session.Url);
    }

    public async Task<StripePaymentEvent?> ParseCompletedCheckoutAsync(string payload, string signature,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.WebhookSecret))
            throw new InvalidOperationException("Stripe:WebhookSecret is not configured.");

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(payload, signature, _options.WebhookSecret);
        }
        catch (StripeException exception)
        {
            throw new InvalidDataException("Invalid Stripe webhook signature or payload.", exception);
        }
        if (stripeEvent.Type != EventTypes.CheckoutSessionCompleted || stripeEvent.Data.Object is not Session session)
            return null;
        if (session.PaymentStatus != "paid" || !session.Metadata.TryGetValue("transactionId", out var rawId)
            || !Guid.TryParse(rawId, out var transactionId))
            return null;

        string? brand = null;
        string? last4 = null;
        if (!string.IsNullOrWhiteSpace(session.PaymentIntentId))
        {
            var paymentIntent = await new PaymentIntentService(CreateClient()).GetAsync(session.PaymentIntentId,
                new PaymentIntentGetOptions { Expand = ["latest_charge"] }, cancellationToken: cancellationToken);
            brand = paymentIntent.LatestCharge?.PaymentMethodDetails?.Card?.Brand;
            last4 = paymentIntent.LatestCharge?.PaymentMethodDetails?.Card?.Last4;
        }

        return new StripePaymentEvent(transactionId, session.Id, brand, last4);
    }

    private StripeClient CreateClient()
    {
        if (string.IsNullOrWhiteSpace(_options.SecretKey))
            throw new InvalidOperationException("External payment gateway credentials are not configured.");

        return new StripeClient(_options.SecretKey);
    }
}
