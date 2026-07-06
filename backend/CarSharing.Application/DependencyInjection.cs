using CarSharing.Application.Users.Dtos;
using CarSharing.Application.Users.Mapping;
using CarSharing.Application.Users.Services;
using CarSharing.Application.Users.Validators;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace CarSharing.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IUserService, UserService>();

        services.AddAutoMapper(_ => { }, typeof(UserMappingProfile).Assembly);

        services.AddScoped<IValidator<RegisterUserRequest>, RegisterUserRequestValidator>();
        services.AddScoped<IValidator<LoginUserRequest>, LoginUserRequestValidator>();

        return services;
    }
}
