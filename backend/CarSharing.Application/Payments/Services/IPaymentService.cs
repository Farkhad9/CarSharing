using CarSharing.Application.Common.Models;
using CarSharing.Application.Payments.Dtos;

namespace CarSharing.Application.Payments.Services;

public interface IPaymentService
{
    Task<Result<BalanceDto>> GetBalanceAsync(CancellationToken cancellationToken = default);
    Task<Result<TopUpCheckoutDto>> CreateTopUpCheckoutAsync(TopUpBalanceRequest request, CancellationToken cancellationToken = default);
    Task<Result<bool>> HandleStripeWebhookAsync(string payload, string signature, CancellationToken cancellationToken = default);
    Task<Result<TripPaymentDto>> PayTripAsync(Guid tripId, CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<PaymentTransactionDto>>> GetMyTransactionsAsync(CancellationToken cancellationToken = default);
}
