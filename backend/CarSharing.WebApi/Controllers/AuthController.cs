using CarSharing.Application.Common.Interfaces;
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
    private readonly IEmailVerificationSender _emailVerificationSender;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IUserService userService,
        IEmailVerificationSender emailVerificationSender,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger<AuthController> logger)
    {
        _userService = userService;
        _emailVerificationSender = emailVerificationSender;
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
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

        var user = result.Value!;
        var verificationUrl = BuildEmailVerificationUrl(user.Id);
        var smtpEnabled = _configuration.GetValue<bool>("Smtp:Enabled");
        var emailSent = false;
        var exposeDevelopmentVerificationLink = _configuration.GetValue<bool>("Smtp:ExposeDevelopmentVerificationLink");
        string? emailDeliveryError = null;

        try
        {
            await _emailVerificationSender.SendVerificationAsync(
                user.Email,
                $"{user.FirstName} {user.LastName}".Trim(),
                verificationUrl,
                cancellationToken);
            emailSent = smtpEnabled;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "Email verification delivery failed for {Email}.", user.Email);
            emailDeliveryError = "Verification email could not be delivered. Please try again later.";
        }

        return Created(string.Empty, new
        {
            user,
            emailSent,
            emailDeliveryError,
            emailVerificationUrl = !_environment.IsDevelopment() || !exposeDevelopmentVerificationLink
                ? null
                : verificationUrl
        });
    }

    [HttpPost("verify-email/{id:guid}")]
    public async Task<IActionResult> VerifyEmail(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userService.VerifyEmailAsync(id, cancellationToken);
        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
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

        if (errors.Any(error => error.Code is "User.Disabled" or "User.Blocked"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { errors });
        }

        return BadRequest(new { errors });
    }

    private string BuildEmailVerificationUrl(Guid userId)
    {
        var origin = Request.Headers.Origin.FirstOrDefault();
        var frontendBaseUrl = string.IsNullOrWhiteSpace(origin)
            ? "http://localhost:5173"
            : origin.TrimEnd('/');

        return $"{frontendBaseUrl}/?verifyEmail={userId}";
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
