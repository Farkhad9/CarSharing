using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IPaymentTransactionRepository
{
    Task AddAsync(PaymentTransaction transaction, CancellationToken cancellationToken = default);
    Task<PaymentTransaction?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> HasCompletedTripPaymentAsync(Guid tripId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentTransaction>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
