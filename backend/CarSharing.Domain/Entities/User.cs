using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class User : BaseEntity
{
    private User()
    {
    }

    public string FirstName { get; private set; } = null!;
    public string LastName { get; private set; } = null!;
    public string Email { get; private set; } = null!;
    public string Phone { get; private set; } = null!;
    public string PasswordHash { get; private set; } = null!;
    public decimal Balance { get; private set; }
    public decimal PendingHold { get; private set; }
    public string DriverLicenseNumber { get; private set; } = null!;
    public bool EmailVerified { get; private set; }
    public UserVerificationStatus VerificationStatus { get; private set; } = UserVerificationStatus.Pending;
    public UserRole Role { get; private set; } = UserRole.Rider;
    public DateTime CreatedAt { get; private set; }
    public DateTime? VerifiedAt { get; private set; }

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

    public void VerifyEmail()
    {
        EmailVerified = true;
        VerifiedAt = DateTime.UtcNow;
    }
}
