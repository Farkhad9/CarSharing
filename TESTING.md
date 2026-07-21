# ElectroStreet Testing Guide

## Automated checks

Run these commands from the repository root:

```powershell
dotnet test backend\CarSharing.Application.Tests\CarSharing.Application.Tests.csproj
dotnet build backend\CarSharing.WebApi\CarSharing.WebApi.csproj
Set-Location my-project
npm run lint
npm run build
```

## What the backend tests cover

- Rider registration support logic: email verification, password reset, validation errors, and user blocking rules.
- Reservation flow: available vehicle reservation, two-active-reservation limit, cancel, expiry, and vehicle release.
- Trip flow: starting a ride from a reservation, completion review, payment readiness, and pricing locked at ride time.
- Payments and invoices: balance top-up, Stripe webhook idempotency, trip payment, invoice creation, and low-battery post-trip status.
- Pricing and fleet: Standard/High/Low modes, dynamic vehicle pricing, active trip time, charging state, and stale trip protection.
- Charging and staff work: service task assignment, waiting/in-progress/done/activation flow, battery/range growth, and staff KPI events.
- Admin and SuperAdmin: internal account creation, all validation errors at once, role changes, KYC decisions, blocking, and permanent deletion of Rider/Staff accounts.
- Parking zones and control room: zone validation, dashboard counts, and support ticket workflows.
- Reviews: rating bounds, comment cleanup, publish/hide behavior.

## Manual checks still worth showing

Some flows depend on the browser or external services and should still be shown manually after the automated tests pass:

- Email delivery in Mailtrap/temp mail for verification and reset password.
- Stripe checkout UI redirect and webhook callback.
- Admin/SuperAdmin map clicking, zone drawing, vehicle marker details, and responsive scroll behavior.
- Rider UI reservation, ride timer, payment, and review submission from the browser.
