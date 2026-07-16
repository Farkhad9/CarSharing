using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using CarSharing.Domain.Enums;
using CarSharing.WebApi.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CarSharing.WebApi.Hubs;

[Authorize(Policy = AuthorizationPolicies.StaffOrAdmin)]
public sealed class OperationsHub : Hub
{
    public const string AdminsGroup = "admins";
    public const string StaffGroupPrefix = "staff:";

    public override async Task OnConnectedAsync()
    {
        var role = Context.User?.FindFirstValue(ClaimTypes.Role);
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? Context.User?.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (role is nameof(UserRole.Admin) or nameof(UserRole.SuperAdmin))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, AdminsGroup);
        }

        if (role is nameof(UserRole.Staff) && !string.IsNullOrWhiteSpace(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GetStaffGroup(userId));
        }

        await base.OnConnectedAsync();
    }

    public static string GetStaffGroup(Guid userId) => GetStaffGroup(userId.ToString());

    private static string GetStaffGroup(string userId) => $"{StaffGroupPrefix}{userId}";
}
