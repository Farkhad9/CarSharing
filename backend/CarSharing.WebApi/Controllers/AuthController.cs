using CarSharing.Application.Common.Models;
using CarSharing.Application.Users.Dtos;
using CarSharing.Application.Users.Services;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;

    public AuthController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(
        RegisterUserRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _userService.RegisterAsync(request, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        return Created(string.Empty, result.Value);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(
        LoginUserRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _userService.LoginAsync(request, cancellationToken);

        if (result.IsFailure)
        {
            return ToErrorResponse(result.Errors);
        }

        AppendRefreshTokenCookie(result.Value!);

        return Ok(result.Value);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies["refreshToken"];
        var result = await _userService.RefreshTokenAsync(refreshToken ?? string.Empty, cancellationToken);

        if (result.IsFailure)
        {
            ClearRefreshTokenCookie();
            return ToErrorResponse(result.Errors);
        }

        AppendRefreshTokenCookie(result.Value!);

        return Ok(result.Value);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies["refreshToken"];
        await _userService.LogoutAsync(refreshToken ?? string.Empty, cancellationToken);

        ClearRefreshTokenCookie();

        return NoContent();
    }

    private IActionResult ToErrorResponse(IReadOnlyList<Error> errors)
    {
        if (errors.Any(error => error.Code.StartsWith("Validation.")))
        {
            return BadRequest(new { errors });
        }

        if (errors.Any(error => error.Code == "User.EmailNotUnique"))
        {
            return Conflict(new { errors });
        }

        if (errors.Any(error => error.Code == "User.InvalidCredentials"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code == "User.InvalidRefreshToken"))
        {
            return Unauthorized(new { errors });
        }

        if (errors.Any(error => error.Code == "User.Disabled"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { errors });
        }

        return BadRequest(new { errors });
    }

    private void AppendRefreshTokenCookie(AuthResponse response)
    {
        Response.Cookies.Append(
            "refreshToken",
            response.RefreshToken,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Expires = response.RefreshTokenExpiresAt,
                Path = "/api/auth"
            });
    }

    private void ClearRefreshTokenCookie()
    {
        Response.Cookies.Delete(
            "refreshToken",
            new CookieOptions
            {
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/api/auth"
            });
    }
}
