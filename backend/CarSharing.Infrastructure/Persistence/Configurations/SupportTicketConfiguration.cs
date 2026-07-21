using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class SupportTicketConfiguration : IEntityTypeConfiguration<SupportTicket>
{
    public void Configure(EntityTypeBuilder<SupportTicket> builder)
    {
        builder.ToTable("SupportTickets");

        builder.HasKey(ticket => ticket.Id);

        builder.Property(ticket => ticket.Subject)
            .HasMaxLength(180)
            .IsRequired();

        builder.Property(ticket => ticket.ContextType)
            .HasMaxLength(40);

        builder.Property(ticket => ticket.Category)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(ticket => ticket.Priority)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(ticket => ticket.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.HasMany(ticket => ticket.Messages)
            .WithOne()
            .HasForeignKey(message => message.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(ticket => new { ticket.RiderId, ticket.Category, ticket.ContextType, ticket.ContextId, ticket.Status });
        builder.HasIndex(ticket => ticket.AssignedStaffId);
        builder.HasIndex(ticket => ticket.LastMessageAt);
    }
}
