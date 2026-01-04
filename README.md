# Multi-Tenant LMS SaaS Platform

A production-grade Learning Management System built as a multi-tenant SaaS platform.

## Tech Stack

- **Frontend**: Next.js (App Router), React, TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, RLS, Storage)

## Key Features

- Multi-tenant architecture with subdomain-based tenancy
- Role-based access control (Institute Admin, Teachers, Students)
- Secure authentication (admin-created users only)
- Data isolation via Row Level Security (RLS)
- Soft delete support across all entities

## Project Structure

```
LMS/
├── .cursorrules          # Cursor AI rules for this project
├── CONTEXT.md            # Detailed project context and architecture
├── README.md             # This file
└── [Next.js app structure will be created here]
```

## Getting Started

1. Set up Supabase project
2. Configure environment variables
3. Run database migrations
4. Set up RLS policies
5. Start development server

## Important Notes

- Public signup is disabled
- All users are created by Admins
- Data is strictly isolated per institute
- RLS policies enforce all authorization

See `CONTEXT.md` for detailed architecture and implementation guidelines.

