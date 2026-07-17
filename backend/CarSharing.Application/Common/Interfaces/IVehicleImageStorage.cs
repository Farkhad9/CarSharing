namespace CarSharing.Application.Common.Interfaces;

public interface IVehicleImageStorage
{
    Task<string> SaveAsync(
        string slot,
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken = default);
}
