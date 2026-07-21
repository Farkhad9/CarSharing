using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _dbContext;

    public UserRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<User>> GetAllAsync(
        string? search = null,
        UserRole? role = null,
        bool? isActive = null,
        UserVerificationStatus? verificationStatus = null,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.Trim().ToLowerInvariant();
            query = query.Where(user =>
                user.Email.Contains(normalizedSearch) ||
                user.FirstName.ToLower().Contains(normalizedSearch) ||
                user.LastName.ToLower().Contains(normalizedSearch) ||
                user.Phone.Contains(normalizedSearch));
        }

        if (role.HasValue)
        {
            query = query.Where(user => user.Role == role.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(user => user.IsActive == isActive.Value);
        }

        if (verificationStatus.HasValue)
        {
            query = query.Where(user => user.VerificationStatus == verificationStatus.Value);
        }

        return await query
            .OrderByDescending(user => user.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == id, cancellationToken);
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .FirstOrDefaultAsync(user => user.Email == email, cancellationToken);
    }

    public async Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .FirstOrDefaultAsync(user => user.RefreshTokenHash == refreshTokenHash, cancellationToken);
    }

    public async Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .AnyAsync(user => user.Email == email, cancellationToken);
    }

    public async Task<bool> ExistsByPhoneAsync(string phone, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .AnyAsync(user => user.Phone == phone, cancellationToken);
    }

    public async Task<bool> ExistsByDriverLicenseNumberAsync(string driverLicenseNumber, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .AnyAsync(user => user.DriverLicenseNumber == driverLicenseNumber, cancellationToken);
    }

    public async Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        await _dbContext.Users.AddAsync(user, cancellationToken);
    }

    public async Task DeleteAsync(User user, CancellationToken cancellationToken = default)
    {
        var userId = user.Id;
        var tripIds = await _dbContext.Trips
            .Where(trip => trip.UserId == userId)
            .Select(trip => trip.Id)
            .ToListAsync(cancellationToken);
        var reservationIds = await _dbContext.Reservations
            .Where(reservation => reservation.UserId == userId)
            .Select(reservation => reservation.Id)
            .ToListAsync(cancellationToken);
        var staffTaskIds = await _dbContext.StaffTasks
            .Where(task => task.AssigneeId == userId)
            .Select(task => task.Id)
            .ToListAsync(cancellationToken);
        var riderSupportTicketIds = await _dbContext.SupportTickets
            .Where(ticket => ticket.RiderId == userId)
            .Select(ticket => ticket.Id)
            .ToListAsync(cancellationToken);
        var tripCompletionRequestIds = await _dbContext.TripCompletionRequests
            .Where(request =>
                request.UserId == userId ||
                tripIds.Contains(request.TripId))
            .Select(request => request.Id)
            .ToListAsync(cancellationToken);
        var activeVehicleIds = await _dbContext.Reservations
            .Where(reservation => reservation.UserId == userId && reservation.Status == ReservationStatus.Active)
            .Select(reservation => reservation.VehicleId)
            .Concat(_dbContext.Trips
                .Where(trip =>
                    trip.UserId == userId &&
                    trip.Status != TripStatus.Completed &&
                    trip.Status != TripStatus.Cancelled)
                .Select(trip => trip.VehicleId))
            .Concat(_dbContext.StaffTasks
                .Where(task =>
                    task.AssigneeId == userId &&
                    task.VehicleId.HasValue &&
                    task.Status != StaffTaskStatus.Done)
                .Select(task => task.VehicleId!.Value))
            .Concat(_dbContext.ChargingSessions
                .Where(session =>
                    session.Status == ChargingSessionStatus.Active &&
                    (session.AssignedStaffId == userId ||
                     session.CreatedByUserId == userId ||
                     session.CompletedByUserId == userId ||
                     staffTaskIds.Contains(session.StaffTaskId)))
                .Select(session => session.VehicleId))
            .Distinct()
            .ToListAsync(cancellationToken);
        var paymentTransactionIds = await _dbContext.PaymentTransactions
            .Where(transaction =>
                transaction.UserId == userId ||
                (transaction.TripId.HasValue && tripIds.Contains(transaction.TripId.Value)) ||
                (transaction.ReservationId.HasValue && reservationIds.Contains(transaction.ReservationId.Value)))
            .Select(transaction => transaction.Id)
            .ToListAsync(cancellationToken);

        await _dbContext.Invoices
            .Where(invoice =>
                invoice.UserId == userId ||
                paymentTransactionIds.Contains(invoice.PaymentTransactionId) ||
                (invoice.TripId.HasValue && tripIds.Contains(invoice.TripId.Value)))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.PaymentTransactions
            .Where(transaction => paymentTransactionIds.Contains(transaction.Id))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.TripReviews
            .Where(review => review.UserId == userId || tripIds.Contains(review.TripId))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.TripCompletionPhotos
            .Where(photo => tripCompletionRequestIds.Contains(photo.TripCompletionRequestId))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.TripCompletionRequests
            .Where(request => tripCompletionRequestIds.Contains(request.Id))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.TripCompletionRequests
            .Where(request => request.AssigneeId == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(request => request.AssigneeId, (Guid?)null), cancellationToken);
        await _dbContext.TripCompletionRequests
            .Where(request => request.ReviewedByUserId == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(request => request.ReviewedByUserId, (Guid?)null), cancellationToken);
        await _dbContext.SupportMessages
            .Where(message => riderSupportTicketIds.Contains(message.TicketId))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.SupportTickets
            .Where(ticket => riderSupportTicketIds.Contains(ticket.Id))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.SupportMessages
            .Where(message => message.SenderId == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(message => message.SenderId, (Guid?)null), cancellationToken);
        await _dbContext.SupportTickets
            .Where(ticket => ticket.AssignedStaffId == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(ticket => ticket.AssignedStaffId, (Guid?)null), cancellationToken);
        await _dbContext.ChargingSessions
            .Where(session =>
                session.AssignedStaffId == userId ||
                session.CreatedByUserId == userId ||
                session.CompletedByUserId == userId ||
                staffTaskIds.Contains(session.StaffTaskId))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.StaffTasks
            .Where(task => staffTaskIds.Contains(task.Id))
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.StaffKpiEvents
            .Where(kpiEvent => kpiEvent.StaffUserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.Trips
            .Where(trip => trip.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.Reservations
            .Where(reservation => reservation.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.PasswordResetTokens
            .Where(token => token.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.UserExternalLogins
            .Where(login => login.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _dbContext.Users
            .Where(blockedUser => blockedUser.BlockedByUserId == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(blockedUser => blockedUser.BlockedByUserId, (Guid?)null), cancellationToken);

        if (activeVehicleIds.Count > 0)
        {
            await _dbContext.Vehicles
                .Where(vehicle =>
                    activeVehicleIds.Contains(vehicle.Id) &&
                    vehicle.Status != VehicleStatus.Maintenance)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(vehicle => vehicle.Status, VehicleStatus.Available)
                        .SetProperty(vehicle => vehicle.ChargingStationId, (Guid?)null),
                    cancellationToken);
        }

        _dbContext.Users.Remove(user);
    }
}
