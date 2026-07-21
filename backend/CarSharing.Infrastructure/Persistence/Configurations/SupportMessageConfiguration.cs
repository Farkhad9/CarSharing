using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class SupportMessageConfiguration : IEntityTypeConfiguration<SupportMessage>
{
    public void Configure(EntityTypeBuilder<SupportMessage> builder)
    {
        builder.ToTable("SupportMessages");

        builder.HasKey(message => message.Id);

        builder.Property(message => message.SenderType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(message => message.SenderName)
            .HasMaxLength(140)
            .IsRequired();

        builder.Property(message => message.Body)
            .HasMaxLength(4000)
            .IsRequired();

        builder.HasIndex(message => new { message.TicketId, message.CreatedAt });
    }
}
