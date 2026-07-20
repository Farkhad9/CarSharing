using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.Admin.Services;

public sealed class AdminStatisticsService : IAdminStatisticsService
{
    private const string BakuTimeZoneName = "Asia/Baku";

    private static readonly Error Unauthenticated = new("AdminStatistics.Unauthenticated", "User must be authenticated.");
    private static readonly Error AdminRequired = new("AdminStatistics.AdminRequired", "Only admin or super admin can access live statistics.");
    private static readonly Error SuperAdminRequired = new("AdminStatistics.SuperAdminRequired", "Super admin access is required.");
    private static readonly Error InvalidPeriod = new("Validation.Period", "Period end date must be on or after start date.");
    private static readonly Error StaffNotFound = new("AdminStatistics.StaffNotFound", "Staff user was not found.");

    private readonly IAdminStatisticsRepository _statisticsRepository;
    private readonly IUserRepository _userRepository;
    private readonly IStaffTaskRepository _staffTaskRepository;
    private readonly IStaffKpiEventRepository _staffKpiEventRepository;
    private readonly ITripCompletionRequestRepository _tripCompletionRequestRepository;
    private readonly ITripRepository _tripRepository;
    private readonly IVehicleRepository _vehicleRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public AdminStatisticsService(
        IAdminStatisticsRepository statisticsRepository,
        IUserRepository userRepository,
        IStaffTaskRepository staffTaskRepository,
        IStaffKpiEventRepository staffKpiEventRepository,
        ITripCompletionRequestRepository tripCompletionRequestRepository,
        ITripRepository tripRepository,
        IVehicleRepository vehicleRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser)
    {
        _statisticsRepository = statisticsRepository;
        _userRepository = userRepository;
        _staffTaskRepository = staffTaskRepository;
        _staffKpiEventRepository = staffKpiEventRepository;
        _tripCompletionRequestRepository = tripCompletionRequestRepository;
        _tripRepository = tripRepository;
        _vehicleRepository = vehicleRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
    }

    public async Task<Result<AdminLiveStatisticsDto>> GetLiveStatisticsAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<AdminLiveStatisticsDto>.Failure(accessError);

        var bakuNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, GetBakuTimeZone());
        var todayStart = bakuNow.Date;
        var weekStart = todayStart.AddDays(-GetMondayBasedDayOffset(bakuNow.DayOfWeek));
        var monthStart = new DateTime(bakuNow.Year, bakuNow.Month, 1);
        var tomorrowStart = todayStart.AddDays(1);
        var chartStart = todayStart.AddDays(-29);

        var period = new AdminStatisticsPeriod(
            ToUtc(todayStart),
            ToUtc(tomorrowStart),
            ToUtc(weekStart),
            ToUtc(monthStart),
            ToUtc(chartStart));

        var snapshot = await _statisticsRepository.GetLiveSnapshotAsync(period, cancellationToken);

        var totalVehicles = snapshot.VehicleStatusCounts.Values.Sum();
        var available = CountVehicles(snapshot, VehicleStatus.Available);
        var reserved = CountVehicles(snapshot, VehicleStatus.Reserved);
        var inUse = CountVehicles(snapshot, VehicleStatus.InUse);
        var charging = CountVehicles(snapshot, VehicleStatus.Charging);
        var maintenance = CountVehicles(snapshot, VehicleStatus.Maintenance);
        var utilization = totalVehicles == 0
            ? 0
            : (int)Math.Round(((decimal)(inUse + reserved) / totalVehicles) * 100, MidpointRounding.AwayFromZero);

        var dto = new AdminLiveStatisticsDto(
            snapshot.GeneratedAt,
            BakuTimeZoneName,
            new AdminRideStatisticsDto(
                snapshot.ActiveRides,
                snapshot.PendingCompletionReviewRides,
                snapshot.AwaitingPaymentRides,
                snapshot.CompletedTripsToday),
            new AdminVehicleStatisticsDto(
                totalVehicles,
                available,
                reserved,
                inUse,
                charging,
                maintenance,
                utilization),
            new AdminChargingStatisticsDto(
                snapshot.ActiveChargingSessions,
                charging),
            new AdminRevenueStatisticsDto(
                snapshot.TodayRevenue,
                snapshot.WeekRevenue,
                snapshot.MonthRevenue,
                snapshot.Currency),
            new AdminPaymentStatisticsDto(
                CountPayments(snapshot, PaymentTransactionStatus.Completed),
                CountPayments(snapshot, PaymentTransactionStatus.Pending),
                CountPayments(snapshot, PaymentTransactionStatus.Failed),
                CountPayments(snapshot, PaymentTransactionStatus.Refunded)),
            snapshot.RevenueChart,
            snapshot.TopVehicles);

        return Result<AdminLiveStatisticsDto>.Success(dto);
    }

    public async Task<Result<AdminFinanceStatisticsDto>> GetFinanceStatisticsAsync(
        AdminFinanceStatisticsRequest request,
        CancellationToken cancellationToken = default)
    {
        var accessError = RequireSuperAdmin();
        if (accessError is not null) return Result<AdminFinanceStatisticsDto>.Failure(accessError);
        if (request.To < request.From) return Result<AdminFinanceStatisticsDto>.Failure(InvalidPeriod);

        var fromUtc = ToUtc(request.From.ToDateTime(TimeOnly.MinValue));
        var toUtc = ToUtc(request.To.AddDays(1).ToDateTime(TimeOnly.MinValue));

        var snapshot = await _statisticsRepository.GetFinanceSnapshotAsync(fromUtc, toUtc, cancellationToken);
        return Result<AdminFinanceStatisticsDto>.Success(snapshot);
    }

    public async Task<Result<AdminStaffKpiSummaryDto>> GetStaffKpiAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<AdminStaffKpiSummaryDto>.Failure(accessError);

        var utcNow = DateTime.UtcNow;
        var bakuNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, GetBakuTimeZone());
        var todayStart = bakuNow.Date;
        var weekStart = todayStart.AddDays(-GetMondayBasedDayOffset(bakuNow.DayOfWeek));
        var previousWeekStart = weekStart.AddDays(-7);
        var previousWeekEnd = weekStart;

        var todayStartUtc = ToUtc(todayStart);
        var weekStartUtc = ToUtc(weekStart);
        var previousWeekStartUtc = ToUtc(previousWeekStart);
        var previousWeekEndUtc = ToUtc(previousWeekEnd);

        var staffUsers = await _userRepository.GetAllAsync(role: UserRole.Staff, cancellationToken: cancellationToken);
        var allUsers = await _userRepository.GetAllAsync(cancellationToken: cancellationToken);
        var adminUsers = allUsers
            .Where(user => user.Role is UserRole.Admin or UserRole.SuperAdmin)
            .ToList();
        var systemUserIds = staffUsers
            .Select(staff => staff.Id)
            .Concat(adminUsers.Select(admin => admin.Id))
            .ToList();
        var kpiEvents = await _staffKpiEventRepository.GetByStaffIdsAsync(systemUserIds, cancellationToken);
        var tasks = await _staffTaskRepository.GetAllAsync(cancellationToken);

        var completedEventDtos = new Dictionary<Guid, AdminStaffKpiItemDto>();
        foreach (var kpiEvent in kpiEvents.Where(IsCompletedWorkEvent).Concat(kpiEvents.Where(IsAdminWorkEvent)))
        {
            completedEventDtos[kpiEvent.Id] = await ToCompletedKpiItemDtoAsync(kpiEvent, cancellationToken);
        }

        var rows = staffUsers
            .Select(staff =>
            {
                var staffTasks = tasks.Where(task => task.AssigneeId == staff.Id).ToList();
                var completedTasks = staffTasks
                    .Where(task => task.Status == StaffTaskStatus.Done)
                    .ToList();
                var staffEvents = kpiEvents
                    .Where(kpiEvent => kpiEvent.StaffUserId == staff.Id)
                    .ToList();
                var completedEvents = staffEvents
                    .Where(IsCompletedWorkEvent)
                    .ToList();
                var completedTaskFallbacks = completedTasks
                    .Where(task => staffEvents.All(kpiEvent => kpiEvent.SourceId != task.Id))
                    .ToList();
                var completedThisWeek = completedEvents.Count(kpiEvent => kpiEvent.OccurredAt >= weekStartUtc)
                    + completedTaskFallbacks.Count(task => task.UpdatedAt >= weekStartUtc);
                var completedPreviousWeek = completedEvents.Count(kpiEvent =>
                    kpiEvent.OccurredAt >= previousWeekStartUtc && kpiEvent.OccurredAt < previousWeekEndUtc)
                    + completedTaskFallbacks.Count(task =>
                        task.UpdatedAt >= previousWeekStartUtc && task.UpdatedAt < previousWeekEndUtc);
                var completionDurations = completedEvents
                    .Select(kpiEvent => kpiEvent.DurationMinutes)
                    .Concat(completedTaskFallbacks.Select(task =>
                        Math.Max(0, (int)Math.Round((task.UpdatedAt - task.CreatedAt).TotalMinutes, MidpointRounding.AwayFromZero))))
                    .ToList();
                var averageCompletionMinutes = completionDurations.Count == 0
                    ? 0
                    : (int)Math.Round(completionDurations.Average(), MidpointRounding.AwayFromZero);
                var activeShiftHours = staffEvents
                    .Where(kpiEvent => kpiEvent.OccurredAt >= todayStartUtc)
                    .Sum(kpiEvent => kpiEvent.DurationMinutes / 60m);
                var weeklyChange = CalculatePercentChange(completedThisWeek, completedPreviousWeek);
                var ratings = staffEvents
                    .Where(kpiEvent => kpiEvent.Rating.HasValue)
                    .Select(kpiEvent => kpiEvent.Rating!.Value)
                    .ToList();
                var rating = ratings.Count == 0
                    ? 0
                    : Math.Round(ratings.Average(), 1, MidpointRounding.AwayFromZero);
                var completedTaskItems = completedEvents
                    .Select(kpiEvent => completedEventDtos[kpiEvent.Id])
                    .Concat(completedTaskFallbacks.Select(task => new AdminStaffKpiItemDto(
                        task.Id,
                        task.Title,
                        task.Description,
                        task.UpdatedAt)))
                    .OrderByDescending(item => item.CompletedAt)
                    .Take(20)
                    .ToList();

                return new AdminStaffKpiRowDto(
                    staff.Id,
                    $"{staff.FirstName} {staff.LastName}".Trim(),
                    staff.Email,
                    "Staff",
                    !staff.IsBlocked(utcNow),
                    completedEvents.Count + completedTaskFallbacks.Count,
                    averageCompletionMinutes,
                    rating,
                    staffEvents.Count(kpiEvent => kpiEvent.Type == StaffKpiEventType.ComplaintReceived),
                    staffEvents.Count(kpiEvent => kpiEvent.Type == StaffKpiEventType.PraiseReceived),
                    Math.Round((decimal)activeShiftHours, 1, MidpointRounding.AwayFromZero),
                    weeklyChange,
                    0,
                    staffEvents.Count(kpiEvent => kpiEvent.Type is StaffKpiEventType.TripPhotoApproved or StaffKpiEventType.TripPhotoRejected),
                    staffEvents.Count(kpiEvent => kpiEvent.Type == StaffKpiEventType.SupportTicketClosed),
                    completedTaskItems);
            })
            .OrderByDescending(row => row.OrdersCompleted)
            .ThenBy(row => row.Name)
            .ToList();

        var adminRows = adminUsers
            .Select(admin =>
            {
                var adminEvents = kpiEvents
                    .Where(kpiEvent => kpiEvent.StaffUserId == admin.Id)
                    .ToList();
                var completedAdminEvents = adminEvents
                    .Where(IsAdminWorkEvent)
                    .ToList();
                var completedThisWeek = completedAdminEvents.Count(kpiEvent => kpiEvent.OccurredAt >= weekStartUtc);
                var completedPreviousWeek = completedAdminEvents.Count(kpiEvent =>
                    kpiEvent.OccurredAt >= previousWeekStartUtc && kpiEvent.OccurredAt < previousWeekEndUtc);
                var completionDurations = completedAdminEvents
                    .Select(kpiEvent => kpiEvent.DurationMinutes)
                    .ToList();
                var averageCompletionMinutes = completionDurations.Count == 0
                    ? 0
                    : (int)Math.Round(completionDurations.Average(), MidpointRounding.AwayFromZero);
                var completedItems = completedAdminEvents
                    .Select(kpiEvent => completedEventDtos[kpiEvent.Id])
                    .OrderByDescending(item => item.CompletedAt)
                    .Take(20)
                    .ToList();

                return new AdminStaffKpiRowDto(
                    admin.Id,
                    $"{admin.FirstName} {admin.LastName}".Trim(),
                    admin.Email,
                    admin.Role.ToString(),
                    !admin.IsBlocked(utcNow),
                    completedAdminEvents.Count,
                    averageCompletionMinutes,
                    0,
                    0,
                    0,
                    0,
                    CalculatePercentChange(completedThisWeek, completedPreviousWeek),
                    0,
                    completedAdminEvents.Count,
                    0,
                    completedItems);
            })
            .OrderByDescending(row => row.OrdersCompleted)
            .ThenBy(row => row.Name)
            .ToList();

        var totalCompleted = rows.Sum(row => row.OrdersCompleted);
        var averageMinutes = rows.Count == 0
            ? 0
            : (int)Math.Round(rows.Average(row => row.AverageCompletionMinutes), MidpointRounding.AwayFromZero);
        var averageRating = rows.Count == 0
            ? 0
            : Math.Round(rows.Average(row => row.Rating), 1, MidpointRounding.AwayFromZero);
        var weeklyAverage = rows.Count == 0
            ? 0
            : (int)Math.Round(rows.Average(row => row.WeeklyChangePercent), MidpointRounding.AwayFromZero);

        var dto = new AdminStaffKpiSummaryDto(
            utcNow,
            BakuTimeZoneName,
            rows.Count(row => row.Active),
            rows.Count,
            totalCompleted,
            averageMinutes,
            averageRating,
            weeklyAverage,
            rows,
            adminRows);

        return Result<AdminStaffKpiSummaryDto>.Success(dto);
    }

    public async Task<Result<AdminStaffKpiItemDto>> RecordStaffKpiEventAsync(
        RecordStaffKpiEventRequest request,
        CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<AdminStaffKpiItemDto>.Failure(accessError);

        var errors = ValidateKpiEventRequest(request);
        if (errors.Count > 0) return Result<AdminStaffKpiItemDto>.Failure(errors);

        var staff = await _userRepository.GetByIdAsync(request.StaffUserId, cancellationToken);
        if (staff is null || staff.Role != UserRole.Staff) return Result<AdminStaffKpiItemDto>.Failure(StaffNotFound);

        var kpiEvent = StaffKpiEvent.Create(
            request.StaffUserId,
            request.Type,
            request.TaskType,
            request.SourceId,
            request.Title,
            request.Result,
            request.OccurredAt,
            request.StartedAt,
            request.CompletedAt,
            request.Rating);

        await _staffKpiEventRepository.AddAsync(kpiEvent, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AdminStaffKpiItemDto>.Success(new AdminStaffKpiItemDto(
            kpiEvent.Id,
            kpiEvent.Title,
            kpiEvent.Result,
            kpiEvent.OccurredAt));
    }

    private Error? RequireAdmin()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin ? null : AdminRequired;
    }

    private Error? RequireSuperAdmin()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role == UserRole.SuperAdmin ? null : SuperAdminRequired;
    }

    private static int CountVehicles(AdminStatisticsSnapshot snapshot, VehicleStatus status) =>
        snapshot.VehicleStatusCounts.TryGetValue(status, out var count) ? count : 0;

    private static int CountPayments(AdminStatisticsSnapshot snapshot, PaymentTransactionStatus status) =>
        snapshot.PaymentStatusCounts.TryGetValue(status, out var count) ? count : 0;

    private static int GetMondayBasedDayOffset(DayOfWeek dayOfWeek) =>
        dayOfWeek == DayOfWeek.Sunday ? 6 : (int)dayOfWeek - 1;

    private static int CalculatePercentChange(int current, int previous)
    {
        if (previous == 0) return current == 0 ? 0 : 100;
        return (int)Math.Round(((decimal)(current - previous) / previous) * 100, MidpointRounding.AwayFromZero);
    }

    private static bool IsCompletedWorkEvent(StaffKpiEvent kpiEvent) =>
        kpiEvent.Type is StaffKpiEventType.ServiceTaskCompleted
            or StaffKpiEventType.TripPhotoApproved
            or StaffKpiEventType.TripPhotoRejected
            or StaffKpiEventType.SupportTicketClosed;

    private static bool IsAdminWorkEvent(StaffKpiEvent kpiEvent) =>
        kpiEvent.Type is StaffKpiEventType.KycVerificationApproved
            or StaffKpiEventType.KycVerificationRejected
            or StaffKpiEventType.KycVerificationReset;

    private async Task<AdminStaffKpiItemDto> ToCompletedKpiItemDtoAsync(
        StaffKpiEvent kpiEvent,
        CancellationToken cancellationToken)
    {
        if (kpiEvent.Type is StaffKpiEventType.TripPhotoApproved or StaffKpiEventType.TripPhotoRejected)
        {
            var title = "Vehicle return photo review";
            var action = kpiEvent.Type == StaffKpiEventType.TripPhotoApproved
                ? "Approved vehicle return photos"
                : "Rejected vehicle return photos";

            var result = await BuildVehicleReturnPhotoResultAsync(action, kpiEvent, cancellationToken);
            return new AdminStaffKpiItemDto(kpiEvent.Id, title, result, kpiEvent.OccurredAt);
        }

        return new AdminStaffKpiItemDto(
            kpiEvent.Id,
            kpiEvent.Title,
            kpiEvent.Result,
            kpiEvent.OccurredAt);
    }

    private async Task<string> BuildVehicleReturnPhotoResultAsync(
        string action,
        StaffKpiEvent kpiEvent,
        CancellationToken cancellationToken)
    {
        if (kpiEvent.SourceId is null)
        {
            return $"{action}.";
        }

        var completionRequest = await _tripCompletionRequestRepository.GetByIdAsync(kpiEvent.SourceId.Value, cancellationToken);
        if (completionRequest is null)
        {
            return $"{action}.";
        }

        var trip = await _tripRepository.GetByIdAsync(completionRequest.TripId, cancellationToken);
        if (trip is null)
        {
            return $"{action} for {completionRequest.RequestedAt:dd.MM.yyyy}.";
        }

        var vehicle = await _vehicleRepository.GetByIdAsync(trip.VehicleId, cancellationToken);
        if (vehicle is null)
        {
            return $"{action} for {completionRequest.RequestedAt:dd.MM.yyyy}.";
        }

        return $"{action} for {completionRequest.RequestedAt:dd.MM.yyyy} - {vehicle.Brand} {vehicle.Model} ({vehicle.PlateNumber}).";
    }

    private static IReadOnlyList<Error> ValidateKpiEventRequest(RecordStaffKpiEventRequest request)
    {
        var errors = new List<Error>();

        if (request.StaffUserId == Guid.Empty)
        {
            errors.Add(new Error("Validation.StaffUserId", "Staff user is required."));
        }

        if (!Enum.IsDefined(request.Type))
        {
            errors.Add(new Error("Validation.Type", "KPI event type is not valid."));
        }

        if (!Enum.IsDefined(request.TaskType))
        {
            errors.Add(new Error("Validation.TaskType", "Task type is not valid."));
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            errors.Add(new Error("Validation.Title", "Title is required."));
        }

        if (string.IsNullOrWhiteSpace(request.Result))
        {
            errors.Add(new Error("Validation.Result", "Result is required."));
        }

        if (request.Rating is < 0 or > 10)
        {
            errors.Add(new Error("Validation.Rating", "Rating must be between 0 and 10."));
        }

        return errors;
    }

    private static DateTime ToUtc(DateTime bakuLocalDateTime)
    {
        var timeZone = GetBakuTimeZone();
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(bakuLocalDateTime, DateTimeKind.Unspecified), timeZone);
    }

    private static TimeZoneInfo GetBakuTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(BakuTimeZoneName);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Azerbaijan Standard Time");
        }
    }
}
