# ElectroStreet

ElectroStreet is a full-stack electric vehicle car-sharing platform. It includes a React customer/admin/staff frontend, an ASP.NET Core Web API backend, SQL Server persistence, JWT authentication, role-based authorization, trip and reservation workflows, payments, invoices, support tickets, charging operations, and real-time operational updates.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Development Accounts](#development-accounts)
- [Testing](#testing)
- [Main API Areas](#main-api-areas)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)

## Overview

ElectroStreet is designed around a real EV car-sharing flow:

1. A rider browses available electric vehicles.
2. The rider reserves a vehicle.
3. The rider starts a trip from an active reservation.
4. The system tracks trip state, pricing, battery usage, invoices, and payments.
5. Staff and admins manage vehicles, support tickets, charging sessions, zones, users, and operational dashboards.

The project is split into a clean .NET backend and a Vite-powered React frontend.

## Features

- Rider registration, login, refresh tokens, logout, email verification, password reset, and external sign-in support.
- Role-based access for Rider, Staff, Admin, and SuperAdmin users.
- Vehicle catalog with EV status, battery level, range, pricing, image uploads, and admin management.
- Reservation lifecycle with expiry handling and vehicle release.
- Trip lifecycle with start, active trip lookup, completion requests, review flow, destination data, and battery drain.
- Balance top-up, Stripe checkout integration, trip payment, transaction history, and invoice generation.
- PDF invoice generation and invoice delivery workflow.
- Dynamic pricing modes and pricing breakdowns.
- Parking zone management with allowed/restricted zones.
- Charging station and charging session management.
- Staff task assignment, task status updates, and KPI tracking.
- Support ticket system for riders, staff, and admins.
- Public reviews and admin review moderation.
- SignalR hubs for operations and support real-time updates.
- Scalar/OpenAPI UI for manual API testing.
- Automated backend application tests plus frontend lint/build checks.

## Tech Stack

### Backend

- ASP.NET Core Web API
- .NET 10
- Entity Framework Core
- SQL Server
- JWT Bearer authentication
- Cookie-based refresh token flow
- SignalR
- Scalar.AspNetCore
- Stripe integration
- SMTP email services
- MassTransit with optional RabbitMQ
- xUnit for automated tests

### Frontend

- React
- Vite
- Tailwind CSS
- Leaflet / React Leaflet
- Three.js / React Three Fiber
- Framer Motion
- SignalR client
- ESLint

### Infrastructure

- Docker Compose
- SQL Server 2022 container
- RabbitMQ management container

## Repository Structure

```text
CarSharing/
├── backend/
│   ├── CarSharing.WebApi/              # ASP.NET Core API, controllers, hubs, config, static uploads
│   ├── CarSharing.Application/         # Business logic, DTOs, services, validators
│   ├── CarSharing.Domain/              # Entities, enums, domain model
│   ├── CarSharing.Infrastructure/      # EF Core, repositories, payments, mail, messaging
│   └── CarSharing.Application.Tests/   # xUnit application/domain tests
├── my-project/                         # React + Vite frontend
├── docker-compose.yml                  # SQL Server and RabbitMQ for local development
├── TESTING.md                          # Test checklist and manual QA notes
├── PROJECT_PLAN.md                     # Project planning notes
├── TASKS.md                            # Task planning notes
└── UI_GUIDE.md                         # UI direction and design notes
```

## Prerequisites

Install these tools before running the project:

- [.NET SDK 10](https://dotnet.microsoft.com/)
- [Node.js](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- SQL Server client tools are optional, but useful for database inspection.

## Configuration

The backend reads configuration from:

- `backend/CarSharing.WebApi/appsettings.json`
- `backend/CarSharing.WebApi/appsettings.Development.json`
- .NET user secrets or environment variables for private values

Important settings:

- `ConnectionStrings:DefaultConnection` - SQL Server connection string.
- `Jwt` - issuer, audience, signing key, and token expiration.
- `Stripe` - payment secret key, webhook secret, success URL, and cancel URL.
- `Smtp` - email delivery configuration.
- `RabbitMq` - optional queue configuration for invoice delivery events.
- `ExternalAuth` - Google/GitHub OAuth and frontend redirect URLs.

The frontend API base URL is controlled with:

```text
VITE_API_URL=http://localhost:5019
```

If `VITE_API_URL` is not provided, the frontend defaults to `http://localhost:5019`.

## Getting Started

### 1. Start Infrastructure

From the repository root:

```powershell
docker compose up -d
```

This starts:

- SQL Server on `localhost:1433`
- RabbitMQ on `localhost:5672`
- RabbitMQ Management UI on `http://localhost:15672`

Default RabbitMQ login:

```text
guest / guest
```

### 2. Apply Database Migrations

From the repository root:

```powershell
dotnet ef database update --project backend\CarSharing.Infrastructure\CarSharing.Infrastructure.csproj --startup-project backend\CarSharing.WebApi\CarSharing.WebApi.csproj
```

### 3. Run the Backend

From the repository root:

```powershell
dotnet run --project backend\CarSharing.WebApi\CarSharing.WebApi.csproj
```

Default backend URLs:

```text
http://localhost:5019
https://localhost:7006
```

### 4. Run the Frontend

Open a second terminal:

```powershell
cd my-project
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

## API Documentation

When the backend is running in Development mode, Scalar is available at:

```text
http://localhost:5019/scalar/v1
```

The OpenAPI JSON document is available at:

```text
http://localhost:5019/openapi/v1.json
```

Use Scalar to manually test endpoints. For protected endpoints:

1. Call `POST /api/auth/login`.
2. Copy the returned access token.
3. Add it as a Bearer token in Scalar.
4. Run authorized requests.

## Development Accounts

The development seeder creates admin users when the backend starts in Development mode.

```text
Admin
Email: admin@carsharing.com
Password: Admin123!

SuperAdmin
Email: superadmin@carsharing.com
Password: SuperAdmin123!
```

SuperAdmin can test most admin, staff-or-admin, and protected endpoints. Rider-only flows still require a Rider account.

## Testing

Run backend automated tests:

```powershell
dotnet test backend\CarSharing.Application.Tests\CarSharing.Application.Tests.csproj
```

Build the backend:

```powershell
dotnet build backend\CarSharing.WebApi\CarSharing.WebApi.csproj
```

Run frontend checks:

```powershell
cd my-project
npm run lint
npm run build
```

Current backend tests cover:

- registration, login support logic, email verification, password reset, and account blocking;
- reservations, cancellation, expiry, and vehicle release;
- trip lifecycle, trip completion, payment readiness, and locked pricing;
- payments, top-ups, Stripe webhook idempotency, invoices, and low-battery post-trip behavior;
- pricing modes and dynamic pricing;
- charging stations, charging sessions, staff tasks, and KPI events;
- admin and SuperAdmin user management;
- parking zones, support tickets, and review moderation rules.

Manual QA is still useful for:

- Scalar endpoint walkthroughs;
- email delivery with SMTP/Mailtrap/Gmail;
- Stripe checkout redirect and webhook callbacks;
- browser flows for rider reservation, trip timer, payment, review submission, and admin map interactions.

## Main API Areas

### Public Endpoints

```http
GET  /scalar/v1
GET  /openapi/v1.json
POST /api/auth/register
POST /api/auth/verify-email/{id}
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/external/{provider}/start
GET  /api/auth/external/{provider}/callback
POST /api/auth/password-reset/request
POST /api/auth/password-reset/confirm
GET  /api/home/summary
GET  /api/vehicles
GET  /api/vehicles/{id}
GET  /api/parking-zones
GET  /api/parking-zones/{id}
GET  /api/charging/stations
GET  /api/charging/stations/{id}
GET  /api/trip-reviews/public
POST /api/newsletter/subscriptions
POST /api/webhooks/stripe
```

### Protected Rider/User Areas

- `/api/users/*`
- `/api/reservations/*`
- `/api/trips/*`
- `/api/payments/*`
- `/api/invoices/*`
- `/api/support/tickets/*`
- `POST /api/trip-reviews`

### Staff/Admin Areas

- `/api/staff/tasks/*`
- `/api/staff/support/tickets/*`
- `/api/admin/users/*`
- `/api/admin/statistics/*`
- `/api/admin/pricing/*`
- `/api/admin/staff/tasks/*`
- `/api/admin/invoices/*`
- `/api/admin/support/tickets/*`
- `/api/admin/trip-reviews/*`

### Real-Time Hubs

```text
/hubs/operations
/hubs/support
```

## Troubleshooting

### Backend Port Is Already in Use

If the backend fails during Kestrel binding, another process is probably using `5019` or `7006`.

Stop the old backend process, close the terminal that is running it, or use the VS Code Ports panel to find the occupied port.

### Database Connection Fails

Make sure Docker Desktop is running and SQL Server is started:

```powershell
docker compose up -d
```

Then apply migrations again.

### Scalar Does Not Open

Confirm the backend is running in Development mode and open:

```text
http://localhost:5019/openapi/v1.json
```

If the JSON opens, the OpenAPI document is available and Scalar should be reachable at:

```text
http://localhost:5019/scalar/v1
```

### Frontend Cannot Reach Backend

Check that:

- backend is running on `http://localhost:5019`;
- frontend is running on `http://localhost:5173`;
- `VITE_API_URL` points to the backend URL if a custom port is used;
- CORS origins in the backend include the frontend URL.

## Security Notes

- Do not commit real SMTP, Stripe, OAuth, or JWT production secrets.
- Prefer .NET user secrets or environment variables for private local configuration.
- Rotate any credentials that were accidentally committed or shown publicly.
- Keep uploaded files and generated invoices out of git; the repository already ignores runtime upload and invoice folders.

