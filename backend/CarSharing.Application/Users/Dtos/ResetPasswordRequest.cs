namespace CarSharing.Application.Users.Dtos;

public sealed record ResetPasswordRequest(string Token, string VerificationCode, string NewPassword, string ConfirmPassword);
