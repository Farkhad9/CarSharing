using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class StaffTaskConfiguration : IEntityTypeConfiguration<StaffTask>
{
    public void Configure(EntityTypeBuilder<StaffTask> builder)
    {
        builder.ToTable("StaffTasks");

        builder.HasKey(task => task.Id);

        builder.Property(task => task.Title)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(task => task.Description)
            .IsRequired()
            .HasMaxLength(800);

        builder.Property(task => task.Priority)
            .IsRequired();

        builder.Property(task => task.Status)
            .IsRequired();

        builder.HasIndex(task => task.AssigneeId);
        builder.HasIndex(task => new { task.VehicleId, task.Status });
    }
}
