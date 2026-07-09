using CarSharing.Application.Common.Models;
using CarSharing.Application.Reservations.Dtos;

namespace CarSharing.Application.Reservations.Services;

public interface IReservationService
{
    Task<Result<ReservationDto>> CreateAsync(CreateReservationRequest request, CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<ReservationDto>>> GetMyActiveAsync(CancellationToken cancellationToken = default);
    Task<Result<ReservationDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<ReservationDto>> CancelAsync(Guid id, CancelReservationRequest request, CancellationToken cancellationToken = default);
    Task<Result<int>> ExpireActiveReservationsAsync(CancellationToken cancellationToken = default);
}
