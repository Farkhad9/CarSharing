using CarSharing.Application.Users.Dtos;
using CarSharing.Application.Users.Mapping;
using CarSharing.Application.Users.Services;
using CarSharing.Application.Users.Validators;
using CarSharing.Application.Reservations.Dtos;
using CarSharing.Application.Reservations.Services;
using CarSharing.Application.Reservations.Validators;
using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Application.Vehicles.Services;
using CarSharing.Application.Vehicles.Validators;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace CarSharing.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IReservationService, ReservationService>();
        services.AddScoped<IVehicleService, VehicleService>();

        services.AddAutoMapper(_ => { }, typeof(UserMappingProfile).Assembly);

        services.AddScoped<IValidator<RegisterUserRequest>, RegisterUserRequestValidator>();
        services.AddScoped<IValidator<LoginUserRequest>, LoginUserRequestValidator>();
        services.AddScoped<IValidator<CreateReservationRequest>, CreateReservationRequestValidator>();
        services.AddScoped<IValidator<CancelReservationRequest>, CancelReservationRequestValidator>();
        services.AddScoped<IValidator<CreateVehicleRequest>, CreateVehicleRequestValidator>();
        services.AddScoped<IValidator<UpdateVehicleRequest>, UpdateVehicleRequestValidator>();
        services.AddScoped<IValidator<UpdateVehicleStatusRequest>, UpdateVehicleStatusRequestValidator>();

        return services;
    }
}
