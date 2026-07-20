namespace CarSharing.Application.Users.Dtos;

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword, string ConfirmPassword);
