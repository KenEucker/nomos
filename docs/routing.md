# Nomos Routing Architecture

This document describes the routing structure for the Nomos platform.

## Overview

The Nomos platform is designed to run on a subdomain like `api.example.com` where:
- **API routes** are served at the root path (`/`)
- **Admin UI** is served under `/admin`

## Route Structure

### API Routes (Root `/`)

All public API endpoints are accessible at the root path:

| Path | Description |
|------|-------------|
| `/health` | Health check endpoint |
| `/ready` | Readiness check endpoint |
| `/version` | Version information |
| `/auth/login` | User authentication |
| `/auth/logout` | User logout |
| `/auth/me` | Get current user |
| `/auth/dev/token` | Generate dev JWT token |
| `/users` | User management |
| `/users/:id` | Individual user operations |
| `/users/:id/roles` | User role management |
| `/roles` | List available roles |
| `/uploads/:key` | File uploads |
| `/webhooks/:provider` | Inbound webhooks |

### Admin UI (`/admin/*`)

The admin dashboard is served at `/admin`:

| Path | Description |
|------|-------------|
| `/admin` | Dashboard |
| `/admin/login` | Admin login page |
| `/admin/users` | User management UI |
| `/admin/api-keys` | API key management |
| `/admin/webhooks` | Webhook configuration |
| `/admin/jobs` | Background jobs |
| `/admin/audit` | Audit log |
| `/admin/errors` | Error tracking |
| `/admin/routes` | Route diagnostics |
| `/admin/diagnostics` | System diagnostics |
| `/admin/docs` | API documentation viewer |

### Admin API Routes (`/admin/api/*`)

Admin-specific API endpoints for the dashboard:

| Path | Description |
|------|-------------|
| `/admin/api/jobs` | Job management |
| `/admin/api/audit` | Audit log queries |
| `/admin/api/api-keys` | API key CRUD |
| `/admin/api/hooks` | Webhook management |
| `/admin/api/diagnostics` | System diagnostics |
| `/admin/api/errors` | Error queries |
| `/admin/api/routes` | Route information |

### Documentation

| Path | Description |
|------|-------------|
| `/docs` | Swagger UI |
| `/openapi.json` | OpenAPI specification |

## Authentication

The API supports three authentication methods:

1. **Session Cookie** (`session_id`) - Set by `/auth/login`
2. **API Key** (`X-API-Key` header) - For programmatic access
3. **JWT Bearer Token** (`Authorization: Bearer <token>`) - From `/auth/login` or `/auth/dev/token`

## Static Assets

Admin UI static assets are served from `/admin/_astro/*`.

## Development vs Production

- **Development**: Admin UI requests to `/admin/*` are proxied to the Astro dev server for hot reload
- **Production**: Admin UI is served from pre-built Astro output
