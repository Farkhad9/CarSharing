using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("Reservations");

        builder.HasKey(reservation => reservation.Id);

        builder.Property(reservation => reservation.UserId)
            .IsRequired();

        builder.Property(reservation => reservation.VehicleId)
            .IsRequired();

        builder.Property(reservation => reservation.ReservedAt)
            .IsRequired();

        builder.Property(reservation => reservation.ExpiresAt)
            .IsRequired();

        builder.Property(reservation => reservation.HoldAmount)
            .HasPrecision(18, 2);

        builder.Property(reservation => reservation.Currency)
            .IsRequired()
            .HasMaxLength(3);

        builder.Property(reservation => reservation.CancelReason)
            .HasMaxLength(500);

        builder.Property(reservation => reservation.Status)
            .IsRequired();

        builder.HasIndex(reservation => new { reservation.UserId, reservation.Status });
        builder.HasIndex(reservation => new { reservation.VehicleId, reservation.Status });
        builder.HasIndex(reservation => new { reservation.Status, reservation.ExpiresAt });
    }
}
