using CarSharing.Application.Users.Dtos;

namespace CarSharing.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    string GenerateToken(UserDto user);
}
