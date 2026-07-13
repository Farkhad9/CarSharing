using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class ChargingSessionConfiguration : IEntityTypeConfiguration<ChargingSession>
{
    public void Configure(EntityTypeBuilder<ChargingSession> builder)
    {
        builder.ToTable("ChargingSessions");

        builder.HasKey(session => session.Id);

        builder.Property(session => session.Status)
            .IsRequired();

        builder.Property(session => session.Notes)
            .HasMaxLength(500);

        builder.HasOne<Vehicle>()
            .WithMany()
            .HasForeignKey(session => session.VehicleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<ChargingStation>()
            .WithMany()
            .HasForeignKey(session => session.ChargingStationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<StaffTask>()
            .WithMany()
            .HasForeignKey(session => session.StaffTaskId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(session => new { session.VehicleId, session.Status })
            .HasFilter($"[{nameof(ChargingSession.Status)}] = {(int)ChargingSessionStatus.Active}");

        builder.HasIndex(session => new { session.ChargingStationId, session.Status });
        builder.HasIndex(session => session.AssignedStaffId);
    }
}
