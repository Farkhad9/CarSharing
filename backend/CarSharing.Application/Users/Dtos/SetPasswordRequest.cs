namespace CarSharing.Application.Users.Dtos;

public sealed record SetPasswordRequest(string NewPassword, string ConfirmPassword);
