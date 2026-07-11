using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public class TripConfiguration : IEntityTypeConfiguration<Trip>
{
    public void Configure(EntityTypeBuilder<Trip> builder)
    {
        builder.ToTable("Trips");

        builder.HasKey(trip => trip.Id);

        builder.Property(trip => trip.Status)
            .IsRequired();

        builder.Property(trip => trip.StartLocationLabel)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(trip => trip.EndLocationLabel)
            .HasMaxLength(200);

        builder.Property(trip => trip.PricePerMinute)
            .HasPrecision(18, 2);

        builder.Property(trip => trip.BasePrice)
            .HasPrecision(18, 2);

        builder.Property(trip => trip.DiscountAmount)
            .HasPrecision(18, 2);

        builder.Property(trip => trip.TotalPrice)
            .HasPrecision(18, 2);

        builder.Property(trip => trip.Currency)
            .IsRequired()
            .HasMaxLength(3);

        builder.Property(trip => trip.PromoCode)
            .HasMaxLength(50);

        builder.HasIndex(trip => new { trip.UserId, trip.Status });
        builder.HasIndex(trip => trip.ReservationId);
        builder.HasIndex(trip => new { trip.VehicleId, trip.Status });
    }
}
