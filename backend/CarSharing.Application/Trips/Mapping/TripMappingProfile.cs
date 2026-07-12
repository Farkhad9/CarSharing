using AutoMapper;
using CarSharing.Application.Pricing.Dtos;
using CarSharing.Application.Trips.Dtos;
using CarSharing.Domain.Entities;

namespace CarSharing.Application.Trips.Mapping;

public class TripMappingProfile : Profile
{
    public TripMappingProfile()
    {
        CreateMap<Trip, TripDto>()
            .ForMember(destination => destination.PricingBreakdown,
                options => options.MapFrom(source => new PricingBreakdownDto(
                    source.BasePricePerMinute,
                    source.DemandMultiplier,
                    source.ZoneMultiplier,
                    source.BatteryMultiplier,
                    source.PricePerMinute,
                    source.DurationMinutes,
                    source.BasePrice,
                    source.DiscountAmount,
                    source.TotalPrice,
                    source.Currency)))
            .ForMember(destination => destination.LatestCompletionRequest,
                options => options.Ignore());

        CreateMap<TripCompletionRequest, TripCompletionRequestDto>()
            .ForMember(destination => destination.Photos,
                options => options.MapFrom(source => source.Photos.OrderBy(photo => photo.Angle)));

        CreateMap<TripCompletionPhoto, TripCompletionPhotoDto>();
    }
}
