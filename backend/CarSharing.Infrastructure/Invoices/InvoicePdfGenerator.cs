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
                page.Margin(42);
                page.Size(PageSizes.A4);
                page.PageColor(Colors.Grey.Lighten5);
                page.DefaultTextStyle(x => x.FontSize(11).FontColor(Colors.Grey.Darken3));

                page.Header()
                    .Background(Colors.Red.Medium)
                    .Padding(24)
                    .Column(column =>
                {
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Column(header =>
                        {
                            header.Item().Text("ElectroStreet").FontSize(28).Bold().FontColor(Colors.White);
                            header.Item().Text("Official payment receipt").FontSize(12).FontColor(Colors.Red.Lighten5);
                        });

                        row.ConstantItem(120).AlignRight().AlignMiddle().Text(model.Status.ToUpperInvariant())
                            .FontSize(11)
                            .Bold()
                            .FontColor(Colors.White);
                    });
                });

                page.Content().PaddingTop(24).Column(column =>
                {
                    column.Spacing(18);

                    column.Item()
                        .Background(Colors.White)
                        .Border(1)
                        .BorderColor(Colors.Grey.Lighten3)
                        .Padding(22)
                        .Column(summary =>
                        {
                            summary.Spacing(14);
                            summary.Item().Text(model.InvoiceNumber).FontSize(20).Bold().FontColor(Colors.Grey.Darken4);
                            summary.Item().Row(row =>
                            {
                                row.RelativeItem().Column(customer =>
                                {
                                    customer.Item().Text("Customer").FontSize(9).Bold().FontColor(Colors.Grey.Medium);
                                    customer.Item().Text(model.CustomerEmail).FontSize(12).SemiBold().FontColor(Colors.Grey.Darken3);
                                });

                                row.RelativeItem().AlignRight().Column(date =>
                                {
                                    date.Item().AlignRight().Text("Paid at").FontSize(9).Bold().FontColor(Colors.Grey.Medium);
                                    date.Item().AlignRight().Text(FormatBakuDateTime(model.PaidAt)).FontSize(12).SemiBold().FontColor(Colors.Grey.Darken3);
                                });
                            });

                            summary.Item()
                                .Background(Colors.Grey.Darken4)
                                .Padding(18)
                                .Row(row =>
                                {
                                    row.RelativeItem().Column(total =>
                                    {
                                        total.Item().Text("Total paid").FontSize(10).Bold().FontColor(Colors.Grey.Lighten1);
                                        total.Item().Text($"{model.Total:F2} {model.Currency}").FontSize(28).Bold().FontColor(Colors.White);
                                    });

                                    row.ConstantItem(150).AlignRight().AlignMiddle().Text(model.Type == InvoiceType.TripPayment ? "Trip payment" : "Balance top-up")
                                        .FontSize(12)
                                        .Bold()
                                        .FontColor(Colors.Red.Lighten3);
                                });
                        });

                    column.Item()
                        .Background(Colors.White)
                        .Border(1)
                        .BorderColor(Colors.Grey.Lighten3)
                        .Padding(18)
                        .Column(details =>
                    {
                        details.Spacing(8);
                        details.Item().Text("Payment details").FontSize(14).Bold().FontColor(Colors.Grey.Darken4);
                        details.Item().Table(table =>
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
                            if (model.DurationSeconds is not null) AddRow(table, "Duration", FormatBillingDuration(model.DurationMinutes, model.DurationSeconds.Value));
                            else if (model.DurationMinutes is not null) AddRow(table, "Duration", $"{model.DurationMinutes} min");
                            if (!string.IsNullOrWhiteSpace(model.PromoCode)) AddRow(table, "Promo code", model.PromoCode.ToUpperInvariant());
                            if (model.DiscountPercent is not null && model.DiscountAmount is not null)
                            {
                                AddRow(table, "Discount", $"{model.DiscountPercent}% (-{model.DiscountAmount:F2} {model.Currency})");
                            }
                            AddRow(table, "Total", $"{model.Total:F2} {model.Currency}");
                        });
                    });

                    column.Item().AlignRight().Width(132).Svg(AuthenticityStampSvg(model.InvoiceNumber));
                });

                page.Footer()
                    .PaddingTop(10)
                    .BorderTop(1)
                    .BorderColor(Colors.Grey.Lighten3)
                    .AlignCenter()
                    .Text("Thank you for riding with ElectroStreet. This receipt was generated by ElectroStreet.")
                    .FontSize(9)
                    .FontColor(Colors.Grey.Medium);
            });
        });
    }

    private static void AddRow(TableDescriptor table, string label, string value)
    {
        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).PaddingVertical(8).Text(label).SemiBold();
        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).PaddingVertical(8).AlignRight().Text(value);
    }

    private static string FormatBakuDateTime(DateTime value)
    {
        var utcValue = value.Kind == DateTimeKind.Utc
            ? value
            : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        var timeZone = GetBakuTimeZone();
        var bakuTime = TimeZoneInfo.ConvertTimeFromUtc(utcValue, timeZone);
        return $"{bakuTime:yyyy-MM-dd HH:mm}";
    }

    private static TimeZoneInfo GetBakuTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Azerbaijan Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Baku");
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Baku");
        }
    }

    private static string FormatDuration(int totalSeconds)
    {
        var minutes = totalSeconds / 60;
        var seconds = totalSeconds % 60;
        if (minutes <= 0) return $"{seconds} sec";
        if (seconds == 0) return $"{minutes} min";
        return $"{minutes} min {seconds} sec";
    }

    private static string FormatBillingDuration(int? billingMinutes, int actualSeconds)
    {
        var actualDuration = FormatDuration(actualSeconds);
        if (billingMinutes is null)
        {
            return actualDuration;
        }

        var roundedActualMinutes = Math.Max(1, (int)Math.Ceiling(actualSeconds / 60m));
        if (roundedActualMinutes == billingMinutes.Value)
        {
            return $"{billingMinutes} billing min ({actualDuration})";
        }

        return $"{billingMinutes} billing min";
    }

    private static string AuthenticityStampSvg(string invoiceNumber)
    {
        var shortNumber = invoiceNumber.Length > 10 ? invoiceNumber[^10..] : invoiceNumber;
        return $"""
<svg width="132" height="132" viewBox="0 0 132 132" xmlns="http://www.w3.org/2000/svg">
  <circle cx="66" cy="66" r="58" fill="#FFF5F5" stroke="#EF4444" stroke-width="3"/>
  <circle cx="66" cy="66" r="46" fill="none" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="66" y="39" text-anchor="middle" font-family="Arial" font-size="10" font-weight="700" fill="#EF4444">ELECTROSTREET</text>
  <text x="66" y="63" text-anchor="middle" font-family="Arial" font-size="15" font-weight="800" fill="#111827">ORIGINAL</text>
  <text x="66" y="81" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#EF4444">PDF RECEIPT</text>
  <text x="66" y="99" text-anchor="middle" font-family="Arial" font-size="8" font-weight="700" fill="#6B7280">{shortNumber}</text>
</svg>
""";
    }
}
