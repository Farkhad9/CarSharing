using CarSharing.Application.Common.Models;
using CarSharing.Application.Invoices.Dtos;
using CarSharing.Application.Invoices.Services;
using CarSharing.WebApi.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/invoices")]
public sealed class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _invoiceService;
    private readonly IWebHostEnvironment _environment;

    public InvoicesController(IInvoiceService invoiceService, IWebHostEnvironment environment)
    {
        _invoiceService = invoiceService;
        _environment = environment;
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMy(CancellationToken cancellationToken)
        => ToResponse(await _invoiceService.GetMyInvoicesAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
        => ToResponse(await _invoiceService.GetByIdAsync(id, adminAccess: false, cancellationToken));

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> DownloadPdf(Guid id, CancellationToken cancellationToken)
    {
        var result = await _invoiceService.GetByIdAsync(id, adminAccess: false, cancellationToken);
        return result.IsSuccess ? ToPdf(result.Value!) : ToResponse(result);
    }

    private IActionResult ToPdf(InvoiceDto invoice)
    {
        var webRoot = _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
        var relativePath = invoice.PdfUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(webRoot, relativePath);
        if (!System.IO.File.Exists(fullPath)) return NotFound(new { error = "Receipt PDF was not found." });
        return PhysicalFile(fullPath, "application/pdf", $"{invoice.InvoiceNumber}.pdf");
    }

    private IActionResult ToResponse<T>(Result<T> result)
    {
        if (result.IsSuccess) return Ok(result.Value);
        var errors = result.Errors;
        if (errors.Any(x => x.Code == "Invoice.Unauthenticated")) return Unauthorized(new { errors });
        if (errors.Any(x => x.Code == "Invoice.Forbidden")) return Forbid();
        if (errors.Any(x => x.Code == "Invoice.NotFound")) return NotFound(new { errors });
        return BadRequest(new { errors });
    }
}

[ApiController]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Route("api/admin/invoices")]
public sealed class AdminInvoicesController : ControllerBase
{
    private readonly IInvoiceService _invoiceService;
    private readonly IWebHostEnvironment _environment;

    public AdminInvoicesController(IInvoiceService invoiceService, IWebHostEnvironment environment)
    {
        _invoiceService = invoiceService;
        _environment = environment;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
        => ToResponse(await _invoiceService.GetAllInvoicesAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
        => ToResponse(await _invoiceService.GetByIdAsync(id, adminAccess: true, cancellationToken));

    [HttpGet("{id:guid}/pricing-breakdown")]
    public async Task<IActionResult> GetPricingBreakdown(Guid id, CancellationToken cancellationToken)
        => ToResponse(await _invoiceService.GetPricingBreakdownAsync(id, cancellationToken));

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> DownloadPdf(Guid id, CancellationToken cancellationToken)
    {
        var result = await _invoiceService.GetByIdAsync(id, adminAccess: true, cancellationToken);
        return result.IsSuccess ? ToPdf(result.Value!) : ToResponse(result);
    }

    private IActionResult ToPdf(InvoiceDto invoice)
    {
        var webRoot = _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
        var relativePath = invoice.PdfUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(webRoot, relativePath);
        if (!System.IO.File.Exists(fullPath)) return NotFound(new { error = "Receipt PDF was not found." });
        return PhysicalFile(fullPath, "application/pdf", $"{invoice.InvoiceNumber}.pdf");
    }

    private IActionResult ToResponse<T>(Result<T> result)
    {
        if (result.IsSuccess) return Ok(result.Value);
        var errors = result.Errors;
        if (errors.Any(x => x.Code == "Invoice.AdminRequired")) return Forbid();
        if (errors.Any(x => x.Code == "Invoice.NotFound")) return NotFound(new { errors });
        return BadRequest(new { errors });
    }
}
