using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using CarSharing.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CarSharing.WebApi.Hubs;

[Authorize]
public sealed class SupportHub : Hub
{
    public const string AdminsGroup = "support:admins";
    public const string StaffGroup = "support:staff";
    public const string UserGroupPrefix = "support:user:";

    public override async Task OnConnectedAsync()
    {
        var role = Context.User?.FindFirstValue(ClaimTypes.Role);
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? Context.User?.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!string.IsNullOrWhiteSpace(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GetUserGroup(userId));
        }

        if (role is nameof(UserRole.Staff))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, StaffGroup);
        }

        if (role is nameof(UserRole.Admin) or nameof(UserRole.SuperAdmin))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, AdminsGroup);
        }

        await base.OnConnectedAsync();
    }

    public static string GetUserGroup(Guid userId) => GetUserGroup(userId.ToString());

    private static string GetUserGroup(string userId) => $"{UserGroupPrefix}{userId}";
}
