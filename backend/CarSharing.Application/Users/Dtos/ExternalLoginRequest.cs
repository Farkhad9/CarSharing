namespace CarSharing.Application.Users.Dtos;

public sealed record ExternalLoginRequest(
    string Provider,
    string ProviderUserId,
    string Email,
    string? FirstName,
    string? LastName);
