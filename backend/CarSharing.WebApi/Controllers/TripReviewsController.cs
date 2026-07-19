using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/trip-reviews")]
public sealed class TripReviewsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public TripReviewsController(AppDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet("public")]
    public async Task<IActionResult> GetPublic([FromQuery] int take = 3, CancellationToken cancellationToken = default)
    {
        var safeTake = Math.Clamp(take, 1, 6);
        var reviews = await (
                from review in _dbContext.TripReviews
                join user in _dbContext.Users on review.UserId equals user.Id
                where review.IsPublished
                orderby review.CreatedAt descending
                select new PublicTripReviewResponse(
                    review.Id,
                    $"{user.FirstName} {user.LastName}".Trim(),
                    "ElectroStreet rider",
                    review.Rating,
                    review.Comment,
                    review.CreatedAt))
            .Take(safeTake)
            .ToListAsync(cancellationToken);

        return Ok(reviews);
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(CreateTripReviewRequest request, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not Guid userId)
        {
            return Unauthorized(new { error = "You are not logged in or your session expired. Please sign in again." });
        }

        if (request.Rating is < 1 or > 5)
        {
            return BadRequest(new { error = "Rating must be between 1 and 5." });
        }

        if (string.IsNullOrWhiteSpace(request.Comment))
        {
            return BadRequest(new { error = "Comment is required." });
        }

        var comment = request.Comment.Trim();
        if (comment.Length > 600)
        {
            return BadRequest(new { error = "Comment must be 600 characters or shorter." });
        }

        var tripExists = await _dbContext.Trips
            .AnyAsync(trip => trip.Id == request.TripId && trip.UserId == userId, cancellationToken);

        if (!tripExists)
        {
            return NotFound(new { error = "Trip was not found for your account." });
        }

        var alreadyReviewed = await _dbContext.TripReviews
            .AnyAsync(review => review.TripId == request.TripId, cancellationToken);

        if (alreadyReviewed)
        {
            return Conflict(new { error = "This trip already has a review." });
        }

        var review = TripReview.Create(request.TripId, userId, request.Rating, comment, DateTime.UtcNow);
        _dbContext.TripReviews.Add(review);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetPublic), new { take = 1 }, new TripReviewResponse(
            review.Id,
            review.TripId,
            review.Rating,
            review.Comment,
            review.CreatedAt));
    }

    public sealed record CreateTripReviewRequest(Guid TripId, int Rating, string Comment);

    private sealed record PublicTripReviewResponse(
        Guid Id,
        string Name,
        string Role,
        int Rating,
        string Comment,
        DateTime CreatedAt);

    private sealed record TripReviewResponse(
        Guid Id,
        Guid TripId,
        int Rating,
        string Comment,
        DateTime CreatedAt);
}
