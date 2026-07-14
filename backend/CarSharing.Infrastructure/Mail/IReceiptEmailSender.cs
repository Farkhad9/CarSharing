namespace CarSharing.Infrastructure.Mail;

public interface IReceiptEmailSender
{
    Task SendReceiptAsync(string toEmail, string invoiceNumber, string pdfPath, string pdfUrl, CancellationToken cancellationToken = default);
}
