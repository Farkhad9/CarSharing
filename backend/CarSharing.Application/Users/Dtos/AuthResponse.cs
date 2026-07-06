namespace CarSharing.Application.Users.Dtos;

public class AuthResponse
{
    public string AccessToken { get; set; } = null!;
    public UserDto User { get; set; } = null!;
}
