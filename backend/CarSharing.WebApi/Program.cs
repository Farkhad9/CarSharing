using CarSharing.Application;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Infrastructure;
using CarSharing.Infrastructure.Security;
using CarSharing.WebApi.Auth;
using CarSharing.WebApi.Hubs;
using CarSharing.WebApi.Seeding;
using CarSharing.WebApi.Services;
using CarSharing.Domain.Enums;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

const string FrontendCorsPolicy = "FrontendCorsPolicy";

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

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
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
        policy.WithOrigins("http://localhost:5173")
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
