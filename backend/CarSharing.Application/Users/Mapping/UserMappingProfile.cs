using AutoMapper;
using CarSharing.Application.Users.Dtos;
using CarSharing.Domain.Entities;

namespace CarSharing.Application.Users.Mapping;

public class UserMappingProfile : Profile
{
    public UserMappingProfile()
    {
        CreateMap<User, UserDto>();
    }
}
