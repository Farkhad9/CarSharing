using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
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
}
