namespace CarSharing.Application.Users.Dtos;

public class RegisterUserRequest
{
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string DriverLicenseNumber { get; set; } = null!;
}
