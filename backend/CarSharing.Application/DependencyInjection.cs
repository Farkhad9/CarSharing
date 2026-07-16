using CarSharing.Application.Users.Dtos;
using CarSharing.Application.Users.Mapping;
using CarSharing.Application.Users.Services;
using CarSharing.Application.Users.Validators;
using CarSharing.Application.Reservations.Dtos;
using CarSharing.Application.Reservations.Services;
using CarSharing.Application.Reservations.Validators;
using CarSharing.Application.Trips.Dtos;
using CarSharing.Application.Trips.Services;
using CarSharing.Application.Trips.Validators;
using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Application.Vehicles.Services;
using CarSharing.Application.Vehicles.Validators;
using CarSharing.Application.Payments.Dtos;
using CarSharing.Application.Payments.Services;
using CarSharing.Application.Payments.Validators;
using CarSharing.Application.Pricing.Services;
using CarSharing.Application.Charging.Services;
using CarSharing.Application.StaffTasks.Dtos;
using CarSharing.Application.StaffTasks.Services;
using CarSharing.Application.StaffTasks.Validators;
using CarSharing.Application.Invoices.Services;
using CarSharing.Application.Admin.Services;
using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Admin.Validators;
using CarSharing.Application.Messaging;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace CarSharing.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IReservationService, ReservationService>();
        services.AddScoped<ITripService, TripService>();
        services.AddScoped<IVehicleService, VehicleService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IDynamicPricingService, DynamicPricingService>();
        services.AddScoped<IChargingService, ChargingService>();
        services.AddScoped<IStaffTaskService, StaffTaskService>();
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<IAdminStatisticsService, AdminStatisticsService>();
        services.AddScoped<IAdminUserService, AdminUserService>();
        services.AddScoped<IEventPublisher, NoOpEventPublisher>();

        services.AddAutoMapper(_ => { }, typeof(UserMappingProfile).Assembly);

        services.AddScoped<IValidator<RegisterUserRequest>, RegisterUserRequestValidator>();
        services.AddScoped<IValidator<LoginUserRequest>, LoginUserRequestValidator>();
        services.AddScoped<IValidator<CreateReservationRequest>, CreateReservationRequestValidator>();
        services.AddScoped<IValidator<CancelReservationRequest>, CancelReservationRequestValidator>();
        services.AddScoped<IValidator<StartTripRequest>, StartTripRequestValidator>();
        services.AddScoped<IValidator<RejectTripCompletionRequest>, RejectTripCompletionRequestValidator>();
        services.AddScoped<IValidator<CreateVehicleRequest>, CreateVehicleRequestValidator>();
        services.AddScoped<IValidator<UpdateVehicleRequest>, UpdateVehicleRequestValidator>();
        services.AddScoped<IValidator<UpdateVehicleStatusRequest>, UpdateVehicleStatusRequestValidator>();
        services.AddScoped<IValidator<TopUpBalanceRequest>, TopUpBalanceRequestValidator>();
        services.AddScoped<IValidator<CreateStaffUserRequest>, CreateStaffUserRequestValidator>();
        services.AddScoped<IValidator<CreateAdminUserRequest>, CreateAdminUserRequestValidator>();
        services.AddScoped<IValidator<UpdateUserRoleRequest>, UpdateUserRoleRequestValidator>();
        services.AddScoped<IValidator<UpdateUserVerificationRequest>, UpdateUserVerificationRequestValidator>();
        services.AddScoped<IValidator<BlockUserRequest>, BlockUserRequestValidator>();
        services.AddScoped<IValidator<CreateStaffTaskRequest>, CreateStaffTaskRequestValidator>();

        return services;
    }
}
