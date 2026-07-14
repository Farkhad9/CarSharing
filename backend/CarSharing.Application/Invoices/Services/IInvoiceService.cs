using CarSharing.Application.Common.Models;
using CarSharing.Application.Invoices.Dtos;
using CarSharing.Domain.Entities;

namespace CarSharing.Application.Invoices.Services;

public interface IInvoiceService
{
    Task<Result<InvoiceDto>> CreateForCompletedPaymentAsync(
        PaymentTransaction transaction,
        User user,
        Trip? trip,
        CancellationToken cancellationToken = default);

    Task<Result<IReadOnlyList<InvoiceDto>>> GetMyInvoicesAsync(CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<InvoiceDto>>> GetAllInvoicesAsync(CancellationToken cancellationToken = default);
    Task<Result<InvoiceDto>> GetByIdAsync(Guid id, bool adminAccess, CancellationToken cancellationToken = default);
    Task<Result<InvoicePricingBreakdownDto>> GetPricingBreakdownAsync(Guid id, CancellationToken cancellationToken = default);
}
