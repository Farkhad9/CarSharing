using AutoMapper;
using CarSharing.Application.Reservations.Dtos;
using CarSharing.Domain.Entities;

namespace CarSharing.Application.Reservations.Mapping;

public class ReservationMappingProfile : Profile
{
    public ReservationMappingProfile()
    {
        CreateMap<Reservation, ReservationDto>();
    }
}
