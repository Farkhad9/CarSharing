using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class User : BaseEntity
{
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public decimal Balance { get; set; }
    public decimal PendingHold { get; set; }
    public string DriverLicenseNumber { get; set; } = null!;
    public bool EmailVerified { get; set; }
    public UserVerificationStatus VerificationStatus { get; set; } = UserVerificationStatus.Pending;
    public UserRole Role { get; set; } = UserRole.Rider;
    public DateTime CreatedAt { get; set; }
    public DateTime? VerifiedAt { get; set; }

    public static User CreateRider(
        string firstName,
        string lastName,
        string email,
        string phone,
        string passwordHash,
        string driverLicenseNumber)
    {
        return new User
        {
            Id = Guid.NewGuid(),
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            Phone = phone.Trim(),
            PasswordHash = passwordHash,
            Balance = 0,
            PendingHold = 0,
            DriverLicenseNumber = driverLicenseNumber.Trim(),
            EmailVerified = false,
            VerificationStatus = UserVerificationStatus.Pending,
            Role = UserRole.Rider,
            CreatedAt = DateTime.UtcNow,
            VerifiedAt = null
        };
    }
}
