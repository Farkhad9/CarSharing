using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Invoices.Dtos;
using CarSharing.Domain.Enums;
using Microsoft.Extensions.Hosting;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CarSharing.Infrastructure.Invoices;

public sealed class InvoicePdfGenerator : IInvoicePdfGenerator
{
    private readonly IHostEnvironment _environment;

    public InvoicePdfGenerator(IHostEnvironment environment)
    {
        _environment = environment;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<GeneratedInvoicePdf> GenerateAsync(InvoicePdfModel model, CancellationToken cancellationToken = default)
    {
        var webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");
        var invoiceRoot = Path.Combine(webRoot, "invoices");
        Directory.CreateDirectory(invoiceRoot);

        var fileName = $"{model.InvoiceNumber}.pdf";
        var pdfPath = Path.Combine(invoiceRoot, fileName);

        await Task.Run(() => BuildDocument(model).GeneratePdf(pdfPath), cancellationToken);
        return new GeneratedInvoicePdf(pdfPath, $"/invoices/{fileName}");
    }

    private static Document BuildDocument(InvoicePdfModel model)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(48);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(11).FontColor(Colors.Grey.Darken3));

                page.Header().Column(column =>
                {
                    column.Item().Text("ElectroStreet").FontSize(26).Bold().FontColor(Colors.Red.Medium);
                    column.Item().Text("Payment receipt").FontSize(13).FontColor(Colors.Grey.Darken1);
                });

                page.Content().PaddingVertical(28).Column(column =>
                {
                    column.Spacing(16);
                    column.Item().Text(model.InvoiceNumber).FontSize(20).Bold().FontColor(Colors.Grey.Darken4);
                    column.Item().Text($"Customer: {model.CustomerEmail}");
                    column.Item().Text($"Paid at: {model.PaidAt:yyyy-MM-dd HH:mm} UTC");
                    column.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });

                        AddRow(table, "Type", model.Type == InvoiceType.TripPayment ? "Trip payment" : "Balance top-up");
                        AddRow(table, "Payment method", model.PaymentMethod);
                        AddRow(table, "Status", model.Status);
                        if (model.FinalRate is not null) AddRow(table, "Final rate", $"{model.FinalRate:F2} {model.Currency}/min");
                        if (model.DurationMinutes is not null) AddRow(table, "Duration", $"{model.DurationMinutes} min");
                        AddRow(table, "Total", $"{model.Total:F2} {model.Currency}");
                    });
                });

                page.Footer().AlignCenter().Text("Thank you for riding with ElectroStreet.").FontSize(10).FontColor(Colors.Grey.Medium);
            });
        });
    }

    private static void AddRow(TableDescriptor table, string label, string value)
    {
        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).PaddingVertical(8).Text(label).SemiBold();
        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).PaddingVertical(8).AlignRight().Text(value);
    }
}
