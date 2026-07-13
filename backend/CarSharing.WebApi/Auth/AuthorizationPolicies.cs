namespace CarSharing.WebApi.Auth;

public static class AuthorizationPolicies
{
    public const string AdminOnly = "AdminOnly";
    public const string RiderOnly = "RiderOnly";
    public const string StaffOrAdmin = "StaffOrAdmin";
}
