using CarSharing.Application.Charging.Dtos;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.Charging.Services;

public sealed class ChargingService : IChargingService
{
    private const int FullBatteryPercent = 100;
    private const int MinimumCompletionBatteryPercent = 80;
    private const int ChargingPercentPerMinute = 10;

    private static readonly Error Unauthenticated = new("Charging.Unauthenticated", "User must be authenticated.");
    private static readonly Error StaffRequired = new("Charging.StaffRequired", "Only staff, admin, or super admin can manage charging.");
    private static readonly Error AdminRequired = new("Charging.AdminRequired", "Only admin or super admin can perform this charging action.");
    private static readonly Error VehicleNotFound = new("Charging.VehicleNotFound", "Vehicle was not found.");
    private static readonly Error StationNotFound = new("Charging.StationNotFound", "Charging station was not found.");
    private static readonly Error SessionNotFound = new("Charging.SessionNotFound", "Charging session was not found.");
    private static readonly Error VehicleMustNeedCharging = new("Charging.VehicleMustNeedCharging", "Vehicle must be in charging status before assigning a station.");
    private static readonly Error StationUnavailable = new("Charging.StationUnavailable", "Charging station is unavailable for this vehicle.");
    private static readonly Error StationInUse = new("Charging.StationInUse", "Charging station is used by active charging sessions or assigned vehicles.");
    private static readonly Error ActiveSessionExists = new("Charging.ActiveSessionExists", "Vehicle already has an active charging session.");
    private static readonly Error SessionNotActive = new("Charging.SessionNotActive", "Charging session must be active.");
    private static readonly Error VehicleNotReady = new("Charging.VehicleNotReady", "Vehicle must be charged to at least 80% before activation.");

    private readonly IChargingStationRepository _stationRepository;
    private readonly IChargingSessionRepository _sessionRepository;
    private readonly IStaffTaskRepository _staffTaskRepository;
    private readonly IVehicleRepository _vehicleRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;

    public ChargingService(
        IChargingStationRepository stationRepository,
        IChargingSessionRepository sessionRepository,
        IStaffTaskRepository staffTaskRepository,
        IVehicleRepository vehicleRepository,
        ICurrentUserService currentUser,
        IUnitOfWork unitOfWork)
    {
        _stationRepository = stationRepository;
        _sessionRepository = sessionRepository;
        _staffTaskRepository = staffTaskRepository;
        _vehicleRepository = vehicleRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<ChargingStationDto>>> GetStationsAsync(CancellationToken cancellationToken = default)
    {
        var stations = await _stationRepository.GetAllAsync(cancellationToken);
        return Result<IReadOnlyList<ChargingStationDto>>.Success(stations.Select(MapStation).ToList());
    }

    public async Task<Result<ChargingStationDto>> GetStationByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var station = await _stationRepository.GetByIdAsync(id, cancellationToken);
        return station is null
            ? Result<ChargingStationDto>.Failure(StationNotFound)
            : Result<ChargingStationDto>.Success(MapStation(station));
    }

    public async Task<Result<ChargingStationDto>> CreateStationAsync(CreateChargingStationRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<ChargingStationDto>.Failure(accessError);

        var errors = ValidateStation(request);
        if (errors.Count > 0) return Result<ChargingStationDto>.Failure(errors);

        var name = request.Name.Trim();
        var locationLabel = request.LocationLabel.Trim();
        var existingStation = await _stationRepository.FindMatchingAsync(
            name,
            locationLabel,
            request.Latitude,
            request.Longitude,
            cancellationToken);
        if (existingStation is not null)
        {
            return Result<ChargingStationDto>.Success(MapStation(existingStation));
        }

        var station = ChargingStation.Create(
            name,
            request.Status,
            locationLabel,
            request.Zone.Trim(),
            request.Latitude,
            request.Longitude,
            request.PowerKw,
            request.TotalPorts,
            NormalizeAvailablePorts(request.Status, request.TotalPorts, request.AvailablePorts),
            request.ConnectorTypes);

        await _stationRepository.AddAsync(station, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ChargingStationDto>.Success(MapStation(station));
    }

    public async Task<Result<bool>> DeleteStationAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<bool>.Failure(accessError);

        var station = await _stationRepository.GetByIdAsync(id, cancellationToken);
        if (station is null) return Result<bool>.Failure(StationNotFound);

        var hasActiveSessions = await _stationRepository.HasActiveSessionsAsync(id, cancellationToken);
        var hasAssignedVehicles = await _stationRepository.HasAssignedVehiclesAsync(id, cancellationToken);
        if (hasActiveSessions || hasAssignedVehicles) return Result<bool>.Failure(StationInUse);

        var stations = await _stationRepository.GetAllAsync(cancellationToken);
        var duplicateStations = stations
            .Where(item => IsSameStation(item, station))
            .ToList();

        foreach (var duplicateStation in duplicateStations)
        {
            var duplicateHasActiveSessions = await _stationRepository.HasActiveSessionsAsync(duplicateStation.Id, cancellationToken);
            var duplicateHasAssignedVehicles = await _stationRepository.HasAssignedVehiclesAsync(duplicateStation.Id, cancellationToken);
            if (!duplicateHasActiveSessions && !duplicateHasAssignedVehicles)
            {
                await _sessionRepository.RemoveByStationIdAsync(duplicateStation.Id, cancellationToken);
                _stationRepository.Remove(duplicateStation);
            }
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true);
    }

    public async Task<Result<ChargingStationDto>> UpdateStationStatusAsync(Guid id, UpdateChargingStationStatusRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<ChargingStationDto>.Failure(accessError);

        var station = await _stationRepository.GetByIdAsync(id, cancellationToken);
        if (station is null) return Result<ChargingStationDto>.Failure(StationNotFound);

        station.ChangeStatus(request.Status);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ChargingStationDto>.Success(MapStation(station));
    }

    public async Task<Result<IReadOnlyList<ChargingSessionDto>>> GetActiveSessionsAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireStaffOrAdmin();
        if (accessError is not null) return Result<IReadOnlyList<ChargingSessionDto>>.Failure(accessError);

        var sessions = await _sessionRepository.GetActiveAsync(cancellationToken);
        var mappedSessions = new List<ChargingSessionDto>();
        foreach (var session in sessions)
        {
            var task = await _staffTaskRepository.GetByIdAsync(session.StaffTaskId, cancellationToken);
            mappedSessions.Add(MapSession(session, task, DateTime.UtcNow));
        }

        return Result<IReadOnlyList<ChargingSessionDto>>.Success(mappedSessions);
    }

    public async Task<Result<ChargingSessionDetailsDto>> StartChargingAsync(StartChargingSessionRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<ChargingSessionDetailsDto>.Failure(accessError);

        var validationErrors = ValidateStartRequest(request);
        if (validationErrors.Count > 0) return Result<ChargingSessionDetailsDto>.Failure(validationErrors);

        var vehicle = await _vehicleRepository.GetByIdAsync(request.VehicleId, cancellationToken);
        if (vehicle is null) return Result<ChargingSessionDetailsDto>.Failure(VehicleNotFound);
        if (vehicle.Status != VehicleStatus.Charging) return Result<ChargingSessionDetailsDto>.Failure(VehicleMustNeedCharging);

        var station = await _stationRepository.GetByIdAsync(request.ChargingStationId, cancellationToken);
        if (station is null) return Result<ChargingSessionDetailsDto>.Failure(StationNotFound);
        if (!station.CanStartCharging(vehicle.ConnectorType)) return Result<ChargingSessionDetailsDto>.Failure(StationUnavailable);

        var existingSession = await _sessionRepository.GetActiveByVehicleIdAsync(vehicle.Id, cancellationToken);
        if (existingSession is not null) return Result<ChargingSessionDetailsDto>.Failure(ActiveSessionExists);

        var now = DateTime.UtcNow;
        var staffTask = StaffTask.Create(
            $"Charge {vehicle.Brand} {vehicle.Model}",
            $"Move vehicle {vehicle.PlateNumber} to {station.Name} and charge it to {FullBatteryPercent}%.",
            request.AssignedStaffId,
            vehicle.Id,
            StaffTaskPriority.High,
            now.AddHours(4),
            now,
            StaffTaskType.Charging);

        var session = ChargingSession.Start(
            vehicle,
            station,
            request.AssignedStaffId,
            _currentUser.UserId!.Value,
            staffTask.Id,
            FullBatteryPercent,
            now);

        station.OccupyPort();
        vehicle.StartCharging(station.Id);

        await _staffTaskRepository.AddAsync(staffTask, cancellationToken);
        await _sessionRepository.AddAsync(session, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ChargingSessionDetailsDto>.Success(new ChargingSessionDetailsDto(
            MapSession(session),
            MapTask(staffTask),
            MapStation(station)));
    }

    public async Task<Result<ChargingSessionDetailsDto>> CompleteChargingAsync(Guid sessionId, CompleteChargingSessionRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireStaffOrAdmin();
        if (accessError is not null) return Result<ChargingSessionDetailsDto>.Failure(accessError);

        if (request.FinalBatteryPercent is < MinimumCompletionBatteryPercent or > FullBatteryPercent)
        {
            return Result<ChargingSessionDetailsDto>.Failure(new Error("Validation.FinalBatteryPercent", "Charging can be completed only between 80% and 100%."));
        }

        var session = await _sessionRepository.GetByIdAsync(sessionId, cancellationToken);
        if (session is null) return Result<ChargingSessionDetailsDto>.Failure(SessionNotFound);
        if (session.Status != ChargingSessionStatus.Active) return Result<ChargingSessionDetailsDto>.Failure(SessionNotActive);

        var station = await _stationRepository.GetByIdAsync(session.ChargingStationId, cancellationToken);
        if (station is null) return Result<ChargingSessionDetailsDto>.Failure(StationNotFound);

        var vehicle = await _vehicleRepository.GetByIdAsync(session.VehicleId, cancellationToken);
        if (vehicle is null) return Result<ChargingSessionDetailsDto>.Failure(VehicleNotFound);

        var task = await _staffTaskRepository.GetByIdAsync(session.StaffTaskId, cancellationToken);
        if (task is null) return Result<ChargingSessionDetailsDto>.Failure(new Error("Charging.StaffTaskNotFound", "Staff task was not found."));

        var now = DateTime.UtcNow;
        var currentBatteryPercent = CalculateCurrentBatteryPercent(session, task, now);
        if (request.FinalBatteryPercent > currentBatteryPercent)
        {
            return Result<ChargingSessionDetailsDto>.Failure(new Error("Validation.FinalBatteryPercent", $"Current charging progress is {currentBatteryPercent}%."));
        }

        session.Complete(_currentUser.UserId!.Value, request.FinalBatteryPercent, request.Notes, now);
        vehicle.UpdateBattery(request.FinalBatteryPercent);
        station.ReleasePort();
        task.ChangeStatus(StaffTaskStatus.Done, now);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ChargingSessionDetailsDto>.Success(new ChargingSessionDetailsDto(
            MapSession(session, task, now),
            MapTask(task),
            MapStation(station)));
    }

    public async Task<Result<bool>> ActivateVehicleAsync(Guid vehicleId, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<bool>.Failure(accessError);

        var vehicle = await _vehicleRepository.GetByIdAsync(vehicleId, cancellationToken);
        if (vehicle is null) return Result<bool>.Failure(VehicleNotFound);
        if (vehicle.Status != VehicleStatus.Charging || vehicle.BatteryPercent < MinimumCompletionBatteryPercent)
        {
            return Result<bool>.Failure(VehicleNotReady);
        }

        vehicle.MarkAvailableAfterCharging(vehicle.BatteryPercent);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true);
    }

    private Error? RequireAdmin()
    {
        if (_currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin ? null : AdminRequired;
    }

    private Error? RequireStaffOrAdmin()
    {
        if (_currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role is UserRole.Staff or UserRole.Admin or UserRole.SuperAdmin ? null : StaffRequired;
    }

    private static IReadOnlyList<Error> ValidateStation(CreateChargingStationRequest request)
    {
        var errors = new List<Error>();
        if (string.IsNullOrWhiteSpace(request.Name)) errors.Add(new Error("Validation.Name", "Station name is required."));
        if (string.IsNullOrWhiteSpace(request.LocationLabel)) errors.Add(new Error("Validation.LocationLabel", "Location is required."));
        if (string.IsNullOrWhiteSpace(request.Zone)) errors.Add(new Error("Validation.Zone", "Zone is required."));
        if (request.PowerKw <= 0) errors.Add(new Error("Validation.PowerKw", "Power must be greater than 0."));
        if (request.TotalPorts <= 0) errors.Add(new Error("Validation.TotalPorts", "Total ports must be greater than 0."));
        if (request.AvailablePorts < 0 || request.AvailablePorts > request.TotalPorts)
            errors.Add(new Error("Validation.AvailablePorts", "Available ports must be between 0 and total ports."));
        if (request.ConnectorTypes.Count == 0) errors.Add(new Error("Validation.ConnectorTypes", "At least one connector type is required."));
        return errors;
    }

    private static int NormalizeAvailablePorts(ChargingStationStatus status, int totalPorts, int availablePorts)
    {
        if (status == ChargingStationStatus.Online) return totalPorts;
        if (status is ChargingStationStatus.Busy or ChargingStationStatus.Maintenance or ChargingStationStatus.Offline) return 0;
        return Math.Max(0, Math.Min(totalPorts, availablePorts));
    }

    private static bool IsSameStation(ChargingStation first, ChargingStation second)
    {
        return string.Equals(first.Name.Trim(), second.Name.Trim(), StringComparison.OrdinalIgnoreCase)
            && string.Equals(first.LocationLabel.Trim(), second.LocationLabel.Trim(), StringComparison.OrdinalIgnoreCase)
            && Math.Abs(first.Latitude - second.Latitude) < 0.00001
            && Math.Abs(first.Longitude - second.Longitude) < 0.00001;
    }

    private static IReadOnlyList<Error> ValidateStartRequest(StartChargingSessionRequest request)
    {
        var errors = new List<Error>();
        if (request.VehicleId == Guid.Empty) errors.Add(new Error("Validation.VehicleId", "Vehicle is required."));
        if (request.ChargingStationId == Guid.Empty) errors.Add(new Error("Validation.ChargingStationId", "Charging station is required."));
        if (request.AssignedStaffId == Guid.Empty) errors.Add(new Error("Validation.AssignedStaffId", "Assigned staff member is required."));
        if (request.TargetBatteryPercent != FullBatteryPercent) errors.Add(new Error("Validation.TargetBatteryPercent", "Charging target must be 100%."));
        return errors;
    }

    private static ChargingStationDto MapStation(ChargingStation station) => new(
        station.Id,
        station.Name,
        station.Status,
        station.LocationLabel,
        station.Zone,
        station.Latitude,
        station.Longitude,
        station.PowerKw,
        station.TotalPorts,
        station.AvailablePorts,
        station.GetConnectorTypes());

    private static int CalculateCurrentBatteryPercent(ChargingSession session, StaffTask? task, DateTime now)
    {
        if (session.Status != ChargingSessionStatus.Active)
        {
            return session.CurrentBatteryPercent;
        }

        if (task?.Status != StaffTaskStatus.InProgress)
        {
            return session.StartBatteryPercent;
        }

        var elapsedMinutes = Math.Max(0, (now - task.UpdatedAt).TotalMinutes);
        return Math.Min(
            session.TargetBatteryPercent,
            (int)Math.Round(session.StartBatteryPercent + elapsedMinutes * ChargingPercentPerMinute));
    }

    private static ChargingSessionDto MapSession(ChargingSession session, StaffTask? task = null, DateTime? now = null) => new(
        session.Id,
        session.VehicleId,
        session.ChargingStationId,
        session.AssignedStaffId,
        session.CreatedByUserId,
        session.CompletedByUserId,
        session.StaffTaskId,
        session.Status,
        session.StartedAt,
        session.CompletedAt,
        session.StartBatteryPercent,
        session.TargetBatteryPercent,
        CalculateCurrentBatteryPercent(session, task, now ?? DateTime.UtcNow),
        session.Notes);

    private static StaffTaskDto MapTask(StaffTask task) => new(
        task.Id,
        task.Title,
        task.Description,
        task.AssigneeId,
        task.VehicleId,
        task.Type,
        task.Priority,
        task.DueAt,
        task.Status,
        task.CreatedAt,
        task.UpdatedAt);
}
