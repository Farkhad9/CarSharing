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
    public decimal PricePerMinute { get; private set; }
    public decimal BasePrice { get; private set; }
    public int DiscountPercent { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TotalPrice { get; private set; }
    public string Currency { get; private set; } = "AZN";
    public string? PromoCode { get; private set; }

    public static Trip StartFromReservation(Reservation reservation, Vehicle vehicle, DateTime startedAt)
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
            PricePerMinute = vehicle.PricePerMinute,
            Currency = vehicle.Currency
        };
    }

    public void RequestCompletion(DateTime requestedAt)
    {
        if (EndRequestedAt is null)
        {
            EndRequestedAt = requestedAt;
            DurationMinutes = Math.Max(1, (int)Math.Ceiling((requestedAt - StartedAt).TotalMinutes));
            BasePrice = Math.Round(DurationMinutes * PricePerMinute, 2, MidpointRounding.AwayFromZero);
            TotalPrice = Math.Max(0, BasePrice - DiscountAmount);
        }

        Status = TripStatus.PendingCompletionReview;
    }

    public void MarkAwaitingPayment()
    {
        Status = TripStatus.AwaitingPayment;
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
}
