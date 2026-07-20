using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Users.Dtos;
using CarSharing.Application.Users.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const string ExternalOAuthCookieScheme = "ExternalOAuth";
    private static readonly HashSet<string> SupportedExternalProviders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Google",
        "GitHub"
    };

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

    [HttpGet("external/{provider}/start")]
    public IActionResult StartExternalLogin(string provider, [FromQuery] string? returnUrl = null)
    {
        var normalizedProvider = NormalizeExternalProvider(provider);
        if (!SupportedExternalProviders.Contains(normalizedProvider))
        {
            return BadRequest(new { errors = new[] { new Error("ExternalAuth.ProviderUnsupported", "External sign-in provider is not supported.") } });
        }

        if (!IsExternalProviderConfigured(normalizedProvider))
        {
            return Redirect(BuildExternalAuthFailureUrl("External sign-in is not configured yet."));
        }

        var frontendReturnUrl = IsAllowedFrontendReturnUrl(returnUrl)
            ? returnUrl!
            : BuildExternalAuthSuccessUrl();
        var properties = new AuthenticationProperties
        {
            RedirectUri = Url.Action(nameof(ExternalLoginCallback), new { provider = normalizedProvider })
        };
        properties.Items["frontendReturnUrl"] = frontendReturnUrl;

        return Challenge(properties, normalizedProvider);
    }

    [HttpGet("external/{provider}/callback")]
    public async Task<IActionResult> ExternalLoginCallback(string provider, CancellationToken cancellationToken)
    {
        var normalizedProvider = NormalizeExternalProvider(provider);
        var externalResult = await HttpContext.AuthenticateAsync(ExternalOAuthCookieScheme);
        var frontendReturnUrl = externalResult.Properties?.Items.TryGetValue("frontendReturnUrl", out var storedReturnUrl) == true &&
            IsAllowedFrontendReturnUrl(storedReturnUrl)
                ? storedReturnUrl!
                : BuildExternalAuthSuccessUrl();

        if (!externalResult.Succeeded || externalResult.Principal is null)
        {
            return Redirect(BuildExternalAuthFailureUrl("External sign-in was cancelled or failed.", frontendReturnUrl));
        }

        var providerUserId = externalResult.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = externalResult.Principal.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrWhiteSpace(providerUserId) || string.IsNullOrWhiteSpace(email))
        {
            await HttpContext.SignOutAsync(ExternalOAuthCookieScheme);
            return Redirect(BuildExternalAuthFailureUrl("External account did not provide an email address.", frontendReturnUrl));
        }

        var displayName = externalResult.Principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
        var (firstName, lastName) = SplitExternalName(displayName, email);
        var result = await _userService.ExternalLoginAsync(
            new ExternalLoginRequest(normalizedProvider, providerUserId, email, firstName, lastName),
            cancellationToken);

        await HttpContext.SignOutAsync(ExternalOAuthCookieScheme);

        if (result.IsFailure)
        {
            var message = result.Errors.FirstOrDefault()?.Message ?? "External sign-in failed.";
            return Redirect(BuildExternalAuthFailureUrl(message, frontendReturnUrl));
        }

        AppendRefreshTokenCookie(result.Value!);
        return Redirect(frontendReturnUrl);
    }

    [HttpPost("password-reset/request")]
    public async Task<IActionResult> RequestPasswordReset(
        RequestPasswordResetRequest request,
        CancellationToken cancellationToken)
    {
        Result<PasswordResetResponse> result;
        try
        {
            result = await _userService.RequestPasswordResetAsync(
                request,
                BuildPasswordResetBaseUrl(),
                cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "Password reset request could not be completed.");
            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new { errors = new[] { new Error("Email.DeliveryFailed", "Reset email could not be sent. Please try again later.") } });
        }

        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
    }

    [HttpPost("password-reset/confirm")]
    public async Task<IActionResult> ResetPassword(
        ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _userService.ResetPasswordAsync(request, cancellationToken);

        return result.IsFailure ? ToErrorResponse(result.Errors) : Ok(result.Value);
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

        if (errors.Any(error => error.Code == "User.InvalidPasswordResetToken"))
        {
            return BadRequest(new { errors });
        }

        if (errors.Any(error => error.Code == "User.ExternalLoginNotAllowed"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { errors });
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

    private string BuildPasswordResetBaseUrl()
    {
        var origin = Request.Headers.Origin.FirstOrDefault();
        var frontendBaseUrl = string.IsNullOrWhiteSpace(origin)
            ? "http://localhost:5173"
            : origin.TrimEnd('/');

        return $"{frontendBaseUrl}/auth?mode=reset-password";
    }

    private string BuildExternalAuthSuccessUrl()
    {
        var configuredUrl = _configuration["ExternalAuth:FrontendSuccessUrl"];
        return string.IsNullOrWhiteSpace(configuredUrl)
            ? "http://localhost:5173/auth?external=success"
            : configuredUrl;
    }

    private string BuildExternalAuthFailureUrl(string message, string? frontendReturnUrl = null)
    {
        var configuredFailureUrl = _configuration["ExternalAuth:FrontendFailureUrl"];
        var baseUrl = !string.IsNullOrWhiteSpace(configuredFailureUrl)
            ? configuredFailureUrl
            : TryBuildAuthUrlFromReturnUrl(frontendReturnUrl, out var authUrl)
                ? authUrl
                : "http://localhost:5173/auth";

        return $"{baseUrl}?external=error&message={Uri.EscapeDataString(message)}";
    }

    private bool IsExternalProviderConfigured(string provider)
    {
        var clientId = _configuration[$"ExternalAuth:{provider}:ClientId"];
        var clientSecret = _configuration[$"ExternalAuth:{provider}:ClientSecret"];
        return !string.IsNullOrWhiteSpace(clientId) && !string.IsNullOrWhiteSpace(clientSecret);
    }

    private static bool IsAllowedFrontendReturnUrl(string? returnUrl)
    {
        if (!Uri.TryCreate(returnUrl, UriKind.Absolute, out var uri))
        {
            return false;
        }

        return uri.Scheme is "http" or "https" &&
            uri.Host is "localhost" or "127.0.0.1" &&
            uri.AbsolutePath.StartsWith("/auth", StringComparison.OrdinalIgnoreCase);
    }

    private static bool TryBuildAuthUrlFromReturnUrl(string? returnUrl, out string authUrl)
    {
        authUrl = string.Empty;
        if (!Uri.TryCreate(returnUrl, UriKind.Absolute, out var uri) || !IsAllowedFrontendReturnUrl(returnUrl))
        {
            return false;
        }

        authUrl = $"{uri.Scheme}://{uri.Authority}/auth";
        return true;
    }

    private static string NormalizeExternalProvider(string provider)
    {
        return provider.Trim().ToLowerInvariant() switch
        {
            "google" => "Google",
            "github" => "GitHub",
            _ => provider.Trim()
        };
    }

    private static (string FirstName, string LastName) SplitExternalName(string displayName, string email)
    {
        var fallback = email.Split('@')[0];
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return (fallback, "Rider");
        }

        var parts = displayName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 1 ? (parts[0], "Rider") : (parts[0], parts[1]);
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
