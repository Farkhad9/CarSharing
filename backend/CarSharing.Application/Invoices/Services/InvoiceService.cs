using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Invoices.Dtos;
using CarSharing.Application.Messaging;
using CarSharing.Application.Messaging.Events;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.Invoices.Services;

public sealed class InvoiceService : IInvoiceService
{
    private static readonly Error Unauthenticated = new("Invoice.Unauthenticated", "User must be authenticated.");
    private static readonly Error NotFound = new("Invoice.NotFound", "Invoice was not found.");
    private static readonly Error Forbidden = new("Invoice.Forbidden", "User is not allowed to access this invoice.");
    private static readonly Error AdminRequired = new("Invoice.AdminRequired", "Only admin or super admin can access this invoice endpoint.");

    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IInvoicePdfGenerator _pdfGenerator;
    private readonly IEventPublisher _eventPublisher;
    private readonly IUserRepository _userRepository;
    private readonly ITripRepository _tripRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;

    public InvoiceService(
        IInvoiceRepository invoiceRepository,
        IInvoicePdfGenerator pdfGenerator,
        IEventPublisher eventPublisher,
        IUserRepository userRepository,
        ITripRepository tripRepository,
        ICurrentUserService currentUser,
        IUnitOfWork unitOfWork)
    {
        _invoiceRepository = invoiceRepository;
        _pdfGenerator = pdfGenerator;
        _eventPublisher = eventPublisher;
        _userRepository = userRepository;
        _tripRepository = tripRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<InvoiceDto>> CreateForCompletedPaymentAsync(
        PaymentTransaction transaction,
        User user,
        Trip? trip,
        CancellationToken cancellationToken = default)
    {
        var existing = await _invoiceRepository.GetByPaymentTransactionIdAsync(transaction.Id, cancellationToken);
        if (existing is not null)
        {
            return Result<InvoiceDto>.Success(await MapAsync(existing, cancellationToken));
        }

        var now = transaction.CompletedAt ?? DateTime.UtcNow;
        var type = transaction.Type == PaymentTransactionType.TopUp ? InvoiceType.BalanceTopUp : InvoiceType.TripPayment;
        var invoiceNumber = CreateInvoiceNumber(now, transaction.Id);
        var model = new InvoicePdfModel(
            invoiceNumber,
            user.Email,
            type,
            transaction.Amount,
            transaction.Currency,
            FormatPaymentMethod(transaction),
            "Paid",
            now,
            trip?.PricePerMinute,
            trip?.DurationMinutes,
            GetTripDurationSeconds(trip),
            trip?.PromoCode,
            trip?.DiscountPercent > 0 ? trip.DiscountPercent : null,
            trip?.DiscountAmount > 0 ? trip.DiscountAmount : null,
            transaction.Amount);
        var pdf = await _pdfGenerator.GenerateAsync(model, cancellationToken);
        var invoice = Invoice.Create(
            invoiceNumber,
            transaction.UserId,
            transaction.Id,
            transaction.TripId,
            type,
            transaction.Amount,
            transaction.Currency,
            pdf.PdfPath,
            pdf.PdfUrl,
            now);

        await _invoiceRepository.AddAsync(invoice, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _eventPublisher.PublishAsync(
            InvoiceDeliveryRequestedEvent.Create(
                invoice.Id,
                user.Id,
                user.Email,
                invoice.InvoiceNumber,
                invoice.PdfPath,
                invoice.PdfUrl,
                invoice.Amount,
                invoice.Currency,
                DateTime.UtcNow),
            cancellationToken);

        return Result<InvoiceDto>.Success(await MapAsync(invoice, cancellationToken));
    }

    public async Task<Result<IReadOnlyList<InvoiceDto>>> GetMyInvoicesAsync(CancellationToken cancellationToken = default)
    {
        if (_currentUser.UserId is null) return Result<IReadOnlyList<InvoiceDto>>.Failure(Unauthenticated);

        var invoices = await _invoiceRepository.GetByUserIdAsync(_currentUser.UserId.Value, cancellationToken);
        var items = new List<InvoiceDto>();
        foreach (var invoice in invoices)
        {
            items.Add(await MapAsync(invoice, cancellationToken));
        }

        return Result<IReadOnlyList<InvoiceDto>>.Success(items);
    }

    public async Task<Result<IReadOnlyList<InvoiceDto>>> GetAllInvoicesAsync(CancellationToken cancellationToken = default)
    {
        if (!IsAdmin()) return Result<IReadOnlyList<InvoiceDto>>.Failure(AdminRequired);

        var invoices = await _invoiceRepository.GetAllAsync(cancellationToken);
        var items = new List<InvoiceDto>();
        foreach (var invoice in invoices)
        {
            items.Add(await MapAsync(invoice, cancellationToken));
        }

        return Result<IReadOnlyList<InvoiceDto>>.Success(items);
    }

    public async Task<Result<InvoiceDto>> GetByIdAsync(Guid id, bool adminAccess, CancellationToken cancellationToken = default)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(id, cancellationToken);
        if (invoice is null) return Result<InvoiceDto>.Failure(NotFound);
        if (adminAccess && !IsAdmin()) return Result<InvoiceDto>.Failure(AdminRequired);
        if (!adminAccess && _currentUser.UserId != invoice.UserId) return Result<InvoiceDto>.Failure(Forbidden);

        return Result<InvoiceDto>.Success(await MapAsync(invoice, cancellationToken));
    }

    public async Task<Result<InvoicePricingBreakdownDto>> GetPricingBreakdownAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!IsAdmin()) return Result<InvoicePricingBreakdownDto>.Failure(AdminRequired);

        var invoice = await _invoiceRepository.GetByIdAsync(id, cancellationToken);
        if (invoice is null) return Result<InvoicePricingBreakdownDto>.Failure(NotFound);

        var trip = invoice.TripId is null
            ? null
            : await _tripRepository.GetByIdAsync(invoice.TripId.Value, cancellationToken);

        return Result<InvoicePricingBreakdownDto>.Success(new InvoicePricingBreakdownDto(
            invoice.Id,
            invoice.TripId,
            trip?.BasePricePerMinute,
            trip?.DemandMultiplier,
            trip?.ZoneMultiplier,
            trip?.BatteryMultiplier,
            trip?.PricePerMinute,
            trip?.DurationMinutes,
            trip?.BasePrice,
            trip?.DiscountAmount,
            invoice.Amount,
            invoice.Currency));
    }

    private bool IsAdmin() => _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin;

    private async Task<InvoiceDto> MapAsync(Invoice invoice, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(invoice.UserId, cancellationToken);
        return new InvoiceDto(
            invoice.Id,
            invoice.InvoiceNumber,
            invoice.UserId,
            user?.Email,
            invoice.PaymentTransactionId,
            invoice.TripId,
            invoice.Type,
            invoice.Status,
            invoice.DeliveryStatus,
            invoice.Amount,
            invoice.Currency,
            invoice.PdfUrl,
            invoice.CreatedAt,
            invoice.GeneratedAt,
            invoice.DeliveredAt);
    }

    private static string CreateInvoiceNumber(DateTime now, Guid transactionId)
        => $"INV-{now:yyyyMMdd}-{transactionId.ToString("N")[..8].ToUpperInvariant()}";

    private static string FormatPaymentMethod(PaymentTransaction transaction)
    {
        if (!string.IsNullOrWhiteSpace(transaction.CardBrand) && !string.IsNullOrWhiteSpace(transaction.CardLast4))
        {
            return $"{transaction.CardBrand} **** {transaction.CardLast4}";
        }

        return transaction.PaymentMethod ?? "Payment";
    }

    private static int? GetTripDurationSeconds(Trip? trip)
    {
        if (trip?.EndRequestedAt is null)
        {
            return null;
        }

        return Math.Max(1, (int)Math.Ceiling((trip.EndRequestedAt.Value - trip.StartedAt).TotalSeconds));
    }
}
