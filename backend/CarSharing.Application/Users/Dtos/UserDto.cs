using CarSharing.Domain.Enums;

namespace CarSharing.Application.Users.Dtos;

public class UserDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public decimal Balance { get; set; }
    public decimal PendingHold { get; set; }
    public string DriverLicenseNumber { get; set; } = null!;
    public string? DriverLicenseDocumentUrl { get; set; }
    public string? PassportDocumentUrl { get; set; }
    public bool EmailVerified { get; set; }
    public bool HasPassword { get; set; }
    public UserVerificationStatus VerificationStatus { get; set; }
    public UserRole Role { get; set; }
    public bool IsActive { get; set; }
    public string? BlockReason { get; set; }
    public DateTime? BlockedAt { get; set; }
    public DateTime? BlockedUntil { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? VerificationSubmittedAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
}
