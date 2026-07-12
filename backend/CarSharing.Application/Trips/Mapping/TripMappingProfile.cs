using AutoMapper;
using CarSharing.Application.Trips.Dtos;
using CarSharing.Domain.Entities;

namespace CarSharing.Application.Trips.Mapping;

public class TripMappingProfile : Profile
{
    public TripMappingProfile()
    {
        CreateMap<Trip, TripDto>()
            .ForMember(destination => destination.LatestCompletionRequest,
                options => options.Ignore());

        CreateMap<TripCompletionRequest, TripCompletionRequestDto>()
            .ForMember(destination => destination.Photos,
                options => options.MapFrom(source => source.Photos.OrderBy(photo => photo.Angle)));

        CreateMap<TripCompletionPhoto, TripCompletionPhotoDto>();
    }
}
