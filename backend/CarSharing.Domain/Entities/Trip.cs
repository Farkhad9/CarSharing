using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class Trip : BaseEntity
{
    private Trip()
    {
    }

    public Guid UserId { get; private set; }
    public Guid VehicleId { get; private set; }
    public Guid? ReservationId { get; private set; }
    public TripStatus Status { get; private set; } = TripStatus.Active;
    public DateTime StartedAt { get; private set; }
    public DateTime? EndRequestedAt { get; private set; }
    public DateTime? EndedAt { get; private set; }
    public string StartLocationLabel { get; private set; } = null!;
    public double StartLatitude { get; private set; }
    public double StartLongitude { get; private set; }
    public string? EndLocationLabel { get; private set; }
    public double? EndLatitude { get; private set; }
    public double? EndLongitude { get; private set; }
    public double DistanceKm { get; private set; }
    public int DurationMinutes { get; private set; }
    public decimal BasePricePerMinute { get; private set; }
    public decimal PricePerMinute { get; private set; }
    public decimal DemandMultiplier { get; private set; } = 1.00m;
    public decimal ZoneMultiplier { get; private set; } = 1.00m;
    public decimal BatteryMultiplier { get; private set; } = 1.00m;
    public decimal BasePrice { get; private set; }
    public int DiscountPercent { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TotalPrice { get; private set; }
    public string Currency { get; private set; } = "AZN";
    public string? PromoCode { get; private set; }

    public static Trip StartFromReservation(
        Reservation reservation,
        Vehicle vehicle,
        DateTime startedAt,
        decimal basePricePerMinute,
        decimal demandMultiplier,
        decimal zoneMultiplier,
        decimal batteryMultiplier,
        decimal finalPricePerMinute)
    {
        return new Trip
        {
            Id = Guid.NewGuid(),
            UserId = reservation.UserId,
            VehicleId = vehicle.Id,
            ReservationId = reservation.Id,
            Status = TripStatus.Active,
            StartedAt = startedAt,
            StartLocationLabel = vehicle.LocationLabel,
            StartLatitude = vehicle.Latitude,
            StartLongitude = vehicle.Longitude,
            BasePricePerMinute = basePricePerMinute,
            DemandMultiplier = demandMultiplier,
            ZoneMultiplier = zoneMultiplier,
            BatteryMultiplier = batteryMultiplier,
            PricePerMinute = finalPricePerMinute,
            Currency = vehicle.Currency
        };
    }

    public static Trip StartFromReservation(Reservation reservation, Vehicle vehicle, DateTime startedAt)
    {
        return StartFromReservation(
            reservation,
            vehicle,
            startedAt,
            vehicle.PricePerMinute,
            1.00m,
            1.00m,
            1.00m,
            vehicle.PricePerMinute);
    }

    public void RequestCompletion(DateTime requestedAt)
    {
        if (EndRequestedAt is null)
        {
            EndRequestedAt = requestedAt;
            DurationMinutes = Math.Max(1, (int)Math.Ceiling((requestedAt - StartedAt).TotalMinutes));
            BasePrice = RoundMoney(DurationMinutes * BasePricePerMinute);
            TotalPrice = Math.Max(0, RoundMoney(DurationMinutes * PricePerMinute) - DiscountAmount);
        }

        Status = TripStatus.PendingCompletionReview;
    }

    public void MarkAwaitingPayment()
    {
        Status = TripStatus.AwaitingPayment;
    }

    public void ApplyPromoCode(string promoCode, int discountPercent)
    {
        if (Status != TripStatus.AwaitingPayment)
        {
            throw new InvalidOperationException("Promo code can only be applied before payment.");
        }

        if (!string.IsNullOrWhiteSpace(PromoCode))
        {
            throw new InvalidOperationException("A promo code is already applied to this trip.");
        }

        var normalizedPercent = Math.Clamp(discountPercent, 0, 100);
        var grossPrice = RoundMoney(DurationMinutes * PricePerMinute);
        PromoCode = promoCode.Trim();
        DiscountPercent = normalizedPercent;
        DiscountAmount = RoundMoney(grossPrice * normalizedPercent / 100m);
        TotalPrice = Math.Max(0, grossPrice - DiscountAmount);
    }

    public void CompletePayment()
    {
        if (Status != TripStatus.AwaitingPayment)
        {
            throw new InvalidOperationException("Only a trip awaiting payment can be completed.");
        }

        Status = TripStatus.Completed;
        EndedAt ??= EndRequestedAt ?? DateTime.UtcNow;
    }

    private static decimal RoundMoney(decimal value)
    {
        return Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
