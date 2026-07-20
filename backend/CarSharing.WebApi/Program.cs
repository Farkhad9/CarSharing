using CarSharing.Application;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Infrastructure;
using CarSharing.Infrastructure.Security;
using CarSharing.WebApi.Auth;
using CarSharing.WebApi.Hubs;
using CarSharing.WebApi.Seeding;
using CarSharing.WebApi.Services;
using CarSharing.Domain.Enums;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

const string FrontendCorsPolicy = "FrontendCorsPolicy";
const string ExternalOAuthCookieScheme = "ExternalOAuth";

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSignalR();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<ITripPhotoStorage, LocalTripPhotoStorage>();
builder.Services.AddScoped<IVehicleImageStorage, LocalVehicleImageStorage>();
builder.Services.AddHostedService<ReservationExpiryBackgroundService>();

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()
    ?? throw new InvalidOperationException("Jwt configuration is missing.");

var authenticationBuilder = builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddCookie(ExternalOAuthCookieScheme, options =>
    {
        options.Cookie.Name = "electrostreet.external";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(5);
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SecretKey))
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrWhiteSpace(accessToken) && path.StartsWithSegments("/hubs/operations"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });

if (IsExternalProviderConfigured(builder.Configuration, "Google"))
{
    authenticationBuilder.AddGoogle("Google", options =>
    {
        options.SignInScheme = ExternalOAuthCookieScheme;
        options.ClientId = builder.Configuration["ExternalAuth:Google:ClientId"] ?? string.Empty;
        options.ClientSecret = builder.Configuration["ExternalAuth:Google:ClientSecret"] ?? string.Empty;
        options.CallbackPath = "/api/auth/external/google/oauth-callback";
        options.SaveTokens = false;
    });
}

if (IsExternalProviderConfigured(builder.Configuration, "GitHub"))
{
    authenticationBuilder.AddOAuth("GitHub", options =>
    {
        options.SignInScheme = ExternalOAuthCookieScheme;
        options.ClientId = builder.Configuration["ExternalAuth:GitHub:ClientId"] ?? string.Empty;
        options.ClientSecret = builder.Configuration["ExternalAuth:GitHub:ClientSecret"] ?? string.Empty;
        options.CallbackPath = "/api/auth/external/github/oauth-callback";
        options.AuthorizationEndpoint = "https://github.com/login/oauth/authorize";
        options.TokenEndpoint = "https://github.com/login/oauth/access_token";
        options.UserInformationEndpoint = "https://api.github.com/user";
        options.Scope.Add("user:email");
        options.SaveTokens = false;
        options.Events = new OAuthEvents
        {
            OnCreatingTicket = async context =>
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, context.Options.UserInformationEndpoint);
                request.Headers.Accept.ParseAdd("application/json");
                request.Headers.UserAgent.ParseAdd("ElectroStreet");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", context.AccessToken);

                using var response = await context.Backchannel.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    context.HttpContext.RequestAborted);
                response.EnsureSuccessStatusCode();

                using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync(context.HttpContext.RequestAborted));
                if (context.Identity is not null)
                {
                    var root = payload.RootElement;
                    if (root.TryGetProperty("id", out var id))
                    {
                        context.Identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, id.ToString()));
                    }

                    if (root.TryGetProperty("name", out var name) && !string.IsNullOrWhiteSpace(name.GetString()))
                    {
                        context.Identity.AddClaim(new Claim(ClaimTypes.Name, name.GetString()!));
                    }

                    if (root.TryGetProperty("email", out var profileEmail) && !string.IsNullOrWhiteSpace(profileEmail.GetString()))
                    {
                        context.Identity.AddClaim(new Claim(ClaimTypes.Email, profileEmail.GetString()!));
                    }
                }

                if (!context.Principal!.HasClaim(claim => claim.Type == ClaimTypes.Email))
                {
                    using var emailRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user/emails");
                    emailRequest.Headers.Accept.ParseAdd("application/json");
                    emailRequest.Headers.UserAgent.ParseAdd("ElectroStreet");
                    emailRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", context.AccessToken);

                    using var emailResponse = await context.Backchannel.SendAsync(
                        emailRequest,
                        HttpCompletionOption.ResponseHeadersRead,
                        context.HttpContext.RequestAborted);
                    emailResponse.EnsureSuccessStatusCode();

                    using var emailPayload = JsonDocument.Parse(await emailResponse.Content.ReadAsStringAsync(context.HttpContext.RequestAborted));
                    string? email = null;
                    foreach (var item in emailPayload.RootElement.EnumerateArray())
                    {
                        if (item.TryGetProperty("primary", out var primary) &&
                            primary.GetBoolean() &&
                            item.TryGetProperty("verified", out var verified) &&
                            verified.GetBoolean() &&
                            item.TryGetProperty("email", out var emailProperty))
                        {
                            email = emailProperty.GetString();
                            break;
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(email) && context.Identity is not null)
                    {
                        context.Identity.AddClaim(new Claim(ClaimTypes.Email, email));
                    }
                }
            }
        };
    });
}

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthorizationPolicies.AdminOnly, policy =>
        policy.RequireRole(UserRole.Admin.ToString(), UserRole.SuperAdmin.ToString()));

    options.AddPolicy(AuthorizationPolicies.SuperAdminOnly, policy =>
        policy.RequireRole(UserRole.SuperAdmin.ToString()));

    options.AddPolicy(AuthorizationPolicies.StaffOrAdmin, policy =>
        policy.RequireRole(UserRole.Staff.ToString(), UserRole.Admin.ToString(), UserRole.SuperAdmin.ToString()));

    options.AddPolicy(AuthorizationPolicies.RiderOnly, policy =>
        policy.RequireRole(UserRole.Rider.ToString()));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5174",
                "http://192.168.1.65:5173",
                "http://192.168.1.65:5174")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseCors(FrontendCorsPolicy);

app.UseAuthentication();
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true &&
        !context.Request.Path.StartsWithSegments("/api/auth/logout") &&
        !context.Request.Path.StartsWithSegments("/api/auth/refresh"))
    {
        var userIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        if (Guid.TryParse(userIdValue, out var userId))
        {
            var userRepository = context.RequestServices.GetRequiredService<IUserRepository>();
            var user = await userRepository.GetByIdAsync(userId, context.RequestAborted);
            var now = DateTime.UtcNow;

            if (user is null || user.IsBlocked(now))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    errors = new[]
                    {
                        new
                        {
                            code = "User.Blocked",
                            message = $"User account is blocked. Reason: {user?.BlockReason ?? "Account is not active."}"
                        }
                    }
                }, context.RequestAborted);
                return;
            }

            if (user.TryExpireBlock(now))
            {
                var unitOfWork = context.RequestServices.GetRequiredService<IUnitOfWork>();
                await unitOfWork.SaveChangesAsync(context.RequestAborted);
            }
        }
    }

    await next();
});
app.UseAuthorization();

app.MapControllers();
app.MapHub<OperationsHub>("/hubs/operations");

if (app.Environment.IsDevelopment())
{
    await app.SeedDevelopmentAdminAsync();
}

app.Run();

static bool IsExternalProviderConfigured(IConfiguration configuration, string provider)
{
    var clientId = configuration[$"ExternalAuth:{provider}:ClientId"];
    var clientSecret = configuration[$"ExternalAuth:{provider}:ClientSecret"];
    return !string.IsNullOrWhiteSpace(clientId) && !string.IsNullOrWhiteSpace(clientSecret);
}
