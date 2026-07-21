using CarSharing.Application.Common.Interfaces;
using CarSharing.Infrastructure.Persistence;
using CarSharing.Infrastructure.Persistence.Repositories;
using CarSharing.Infrastructure.Security;
using CarSharing.Infrastructure.Payments;
using CarSharing.Infrastructure.Invoices;
using CarSharing.Infrastructure.Mail;
using CarSharing.Infrastructure.Messaging;
using CarSharing.Application.Messaging;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CarSharing.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserExternalLoginRepository, UserExternalLoginRepository>();
        services.AddScoped<IReservationRepository, ReservationRepository>();
        services.AddScoped<ITripRepository, TripRepository>();
        services.AddScoped<ITripCompletionRequestRepository, TripCompletionRequestRepository>();
        services.AddScoped<IVehicleRepository, VehicleRepository>();
        services.AddScoped<IPaymentTransactionRepository, PaymentTransactionRepository>();
        services.AddScoped<IChargingStationRepository, ChargingStationRepository>();
        services.AddScoped<IChargingSessionRepository, ChargingSessionRepository>();
        services.AddScoped<IStaffTaskRepository, StaffTaskRepository>();
        services.AddScoped<IStaffKpiEventRepository, StaffKpiEventRepository>();
        services.AddScoped<IInvoiceRepository, InvoiceRepository>();
        services.AddScoped<IAdminStatisticsRepository, AdminStatisticsRepository>();
        services.AddScoped<IParkingZoneRepository, ParkingZoneRepository>();
        services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
        services.AddScoped<ISupportTicketRepository, SupportTicketRepository>();
        services.AddScoped<IPricingPolicyRepository, PricingPolicyRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IInvoicePdfGenerator, InvoicePdfGenerator>();
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.Configure<StripeOptions>(configuration.GetSection(StripeOptions.SectionName));
        services.AddScoped<IStripePaymentGateway, StripePaymentGateway>();
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));
        services.AddScoped<IReceiptEmailSender, MailtrapReceiptEmailSender>();
        services.AddScoped<IEmailVerificationSender, SmtpEmailVerificationSender>();
        services.AddScoped<IPasswordResetEmailSender, SmtpPasswordResetEmailSender>();
        services.AddScoped<IAccountSecurityEmailSender, SmtpAccountSecurityEmailSender>();

        var rabbitMqOptions = configuration.GetSection(RabbitMqOptions.SectionName).Get<RabbitMqOptions>() ?? new RabbitMqOptions();
        services.Configure<RabbitMqOptions>(configuration.GetSection(RabbitMqOptions.SectionName));
        if (rabbitMqOptions.Enabled)
        {
            services.AddMassTransit(x =>
            {
                x.AddConsumer<InvoiceDeliveryRequestedConsumer>();
                x.UsingRabbitMq((context, cfg) =>
                {
                    cfg.Host(rabbitMqOptions.Host, rabbitMqOptions.Port, rabbitMqOptions.VirtualHost, host =>
                    {
                        host.Username(rabbitMqOptions.UserName);
                        host.Password(rabbitMqOptions.Password);
                    });

                    cfg.ReceiveEndpoint(rabbitMqOptions.QueueName, endpoint =>
                    {
                        endpoint.ConfigureConsumer<InvoiceDeliveryRequestedConsumer>(context);
                    });
                });
            });
            services.AddScoped<IEventPublisher, MassTransitEventPublisher>();
        }
        else
        {
            services.AddScoped<IEventPublisher, LocalInvoiceDeliveryEventPublisher>();
        }

        return services;
    }
}
