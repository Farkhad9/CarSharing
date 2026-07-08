using System.Text.Json.Serialization;

namespace CarSharing.Application.Users.Dtos;

public class AuthResponse
{
    public string AccessToken { get; set; } = null!;
    public DateTime AccessTokenExpiresAt { get; set; }
    public UserDto User { get; set; } = null!;

    [JsonIgnore]
    public string RefreshToken { get; set; } = null!;

    [JsonIgnore]
    public DateTime RefreshTokenExpiresAt { get; set; }
}
