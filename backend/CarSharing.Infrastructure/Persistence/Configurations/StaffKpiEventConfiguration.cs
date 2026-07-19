using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class StaffKpiEventConfiguration : IEntityTypeConfiguration<StaffKpiEvent>
{
    public void Configure(EntityTypeBuilder<StaffKpiEvent> builder)
    {
        builder.ToTable("StaffKpiEvents");

        builder.HasKey(kpiEvent => kpiEvent.Id);

        builder.Property(kpiEvent => kpiEvent.Type)
            .IsRequired();

        builder.Property(kpiEvent => kpiEvent.TaskType)
            .IsRequired();

        builder.Property(kpiEvent => kpiEvent.Title)
            .IsRequired()
            .HasMaxLength(180);

        builder.Property(kpiEvent => kpiEvent.Result)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(kpiEvent => kpiEvent.Rating)
            .HasPrecision(4, 2);

        builder.HasIndex(kpiEvent => new { kpiEvent.StaffUserId, kpiEvent.OccurredAt });
        builder.HasIndex(kpiEvent => new { kpiEvent.StaffUserId, kpiEvent.SourceId });

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(kpiEvent => kpiEvent.StaffUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
