namespace CarSharing.Application.Vehicles.Dtos;

public class UpdateVehicleImagesRequest
{
    public string? MainImageUrl { get; set; }
    public string? GalleryImageUrl1 { get; set; }
    public string? GalleryImageUrl2 { get; set; }
    public string? GalleryImageUrl3 { get; set; }
}
