using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public class UserExternalLoginConfiguration : IEntityTypeConfiguration<UserExternalLogin>
{
    public void Configure(EntityTypeBuilder<UserExternalLogin> builder)
    {
        builder.ToTable("UserExternalLogins");

        builder.HasKey(login => login.Id);

        builder.Property(login => login.Provider)
            .IsRequired()
            .HasMaxLength(40);

        builder.Property(login => login.ProviderUserId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(login => login.CreatedAt)
            .IsRequired();

        builder.HasIndex(login => new { login.Provider, login.ProviderUserId })
            .IsUnique();

        builder.HasOne(login => login.User)
            .WithMany()
            .HasForeignKey(login => login.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
