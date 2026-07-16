using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Common.Models;

namespace CarSharing.Application.Admin.Services;

public interface IAdminUserService
{
    Task<Result<IReadOnlyList<AdminUserDto>>> GetUsersAsync(
        AdminUsersQuery query,
        CancellationToken cancellationToken = default);

    Task<Result<AdminUserDto>> GetUserAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result<AdminUserDto>> CreateStaffAsync(
        CreateStaffUserRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<AdminUserDto>> CreateAdminAsync(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<AdminUserDto>> UpdateRoleAsync(
        Guid id,
        UpdateUserRoleRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<AdminUserDto>> UpdateStatusAsync(
        Guid id,
        UpdateUserStatusRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<AdminUserDto>> BlockUserAsync(
        Guid id,
        BlockUserRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<AdminUserDto>> UnblockUserAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result<AdminUserDto>> UpdateVerificationAsync(
        Guid id,
        UpdateUserVerificationRequest request,
        CancellationToken cancellationToken = default);
}
