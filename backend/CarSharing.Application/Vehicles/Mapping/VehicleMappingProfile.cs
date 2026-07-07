using AutoMapper;
using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Domain.Entities;

namespace CarSharing.Application.Vehicles.Mapping;

public class VehicleMappingProfile : Profile
{
    public VehicleMappingProfile()
    {
        CreateMap<Vehicle, VehicleDto>();
    }
}
