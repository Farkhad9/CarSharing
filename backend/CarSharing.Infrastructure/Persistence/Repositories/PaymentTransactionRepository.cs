using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class PaymentTransactionRepository : IPaymentTransactionRepository
{
    private readonly AppDbContext _dbContext;
    public PaymentTransactionRepository(AppDbContext dbContext) => _dbContext = dbContext;

    public Task AddAsync(PaymentTransaction transaction, CancellationToken cancellationToken = default)
        => _dbContext.PaymentTransactions.AddAsync(transaction, cancellationToken).AsTask();

    public Task<PaymentTransaction?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _dbContext.PaymentTransactions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<bool> HasCompletedTripPaymentAsync(Guid tripId, CancellationToken cancellationToken = default)
        => _dbContext.PaymentTransactions.AnyAsync(x => x.TripId == tripId
            && x.Type == PaymentTransactionType.RidePayment
            && x.Status == PaymentTransactionStatus.Completed, cancellationToken);

    public async Task<IReadOnlyList<PaymentTransaction>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbContext.PaymentTransactions.Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
}
