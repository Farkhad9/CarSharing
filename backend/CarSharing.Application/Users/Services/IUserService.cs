using CarSharing.Application.Common.Models;
using CarSharing.Application.Users.Dtos;

namespace CarSharing.Application.Users.Services;

public interface IUserService
{
    Task<Result<UserDto>> RegisterAsync(RegisterUserRequest request, CancellationToken cancellationToken = default);
    Task<Result<AuthResponse>> LoginAsync(LoginUserRequest request, CancellationToken cancellationToken = default);
    Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<Result<bool>> LogoutAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<Result<UserDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<UserDto>> VerifyEmailAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<UserDto>> SubmitVerificationDocumentsAsync(
        Guid id,
        string driverLicenseDocumentUrl,
        string passportDocumentUrl,
        CancellationToken cancellationToken = default);
}
