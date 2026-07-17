namespace CarSharing.Application.Common.Interfaces;

public sealed record StripeCheckoutSession(string Id, string Url);
public sealed record StripePaymentEvent(Guid TransactionId, string SessionId, string? CardBrand, string? CardLast4);

public interface IStripePaymentGateway
{
    Task<StripeCheckoutSession> CreateTopUpSessionAsync(Guid transactionId, Guid userId, string email,
        decimal amount, string currency, CancellationToken cancellationToken = default);
    Task<StripeCheckoutSession> CreateTripPaymentSessionAsync(Guid transactionId, Guid userId, Guid tripId, string email,
        decimal amount, string currency, CancellationToken cancellationToken = default);
    Task<StripePaymentEvent?> ParseCompletedCheckoutAsync(string payload, string signature,
        CancellationToken cancellationToken = default);
}
