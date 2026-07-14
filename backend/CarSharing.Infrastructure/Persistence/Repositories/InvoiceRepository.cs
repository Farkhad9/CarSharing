using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class InvoiceRepository : IInvoiceRepository
{
    private readonly AppDbContext _dbContext;
    public InvoiceRepository(AppDbContext dbContext) => _dbContext = dbContext;

    public Task AddAsync(Invoice invoice, CancellationToken cancellationToken = default)
        => _dbContext.Invoices.AddAsync(invoice, cancellationToken).AsTask();

    public Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _dbContext.Invoices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Invoice?> GetByPaymentTransactionIdAsync(Guid paymentTransactionId, CancellationToken cancellationToken = default)
        => _dbContext.Invoices.FirstOrDefaultAsync(x => x.PaymentTransactionId == paymentTransactionId, cancellationToken);

    public async Task<IReadOnlyList<Invoice>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbContext.Invoices.Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Invoice>> GetAllAsync(CancellationToken cancellationToken = default)
        => await _dbContext.Invoices.OrderByDescending(x => x.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);
}
