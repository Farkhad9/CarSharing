using CarSharing.Application.Invoices.Dtos;

namespace CarSharing.Application.Common.Interfaces;

public interface IInvoicePdfGenerator
{
    Task<GeneratedInvoicePdf> GenerateAsync(InvoicePdfModel model, CancellationToken cancellationToken = default);
}

public sealed record GeneratedInvoicePdf(string PdfPath, string PdfUrl);
