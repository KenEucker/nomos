# Nomos

Nomos is an opinionated admin and API platform for Node.js applications, built on Fastify and Astro. It provides a structured, convention-driven foundation for building secure APIs, administrative interfaces, and internal tools with minimal boilerplate.

## Features

- **OpenAPI Documentation**: Automatically generated API docs available at `/api/docs`.
- **Authentication**: Built-in endpoints for user login (`/api/auth/login`) and session management (`/api/auth/me`).
- **Projects and Tasks Management**: Core API endpoints for managing projects and tasks.
- **Role-Based Access Control**: Admin-only features for user and role management.
- **Modern Tech Stack**: Leverages TypeScript, Fastify for the backend, and Astro for the frontend.

## Local Setup

Follow these steps to get your local development environment up and running.

1. **Install Dependencies:**
   ```
   npm install
   ```
2. **Run Database Migrations:**
   ```
   npm run migrate
   ```
3. **Seed the Database:**
   ```
   npm run seed
   ```
4. **Start the Development Server:**
   ```
   npm run dev
   ```
   The application will be available at `http://localhost:3001`.

## Demo Credentials

The seeded database includes three user roles with the following credentials:

- **Admin**: `admin@nomos.local` / `admin123`
- **Editor**: `editor@nomos.local` / `editor123`
- **Viewer**: `viewer@nomos.local` / `viewer123`

## UI Walkthrough

Once the application is running, you can explore the user interface.

- **Login**: Navigate to `http://localhost:3001/login` to sign in with one of the demo accounts.
- **Dashboard**: The main dashboard at `/` displays summary counts and a list of recent tasks.
- **Projects**: View all projects at `/projects` and see project-specific details at `/projects/:id`.
- **Tasks**: Manage individual tasks, including edits, comments, and attachments, at `/tasks/:id`.
- **User Management**: Admins can manage user roles by navigating to `/users`.

## Technical Details

- **Primary Languages**:

  - TypeScript (78.8%)
  - Svelte (19.7%)

- **Backend Framework**: Fastify

- **Frontend Framework**: Astro

- **License**: This project is licensed under the [AGPL-3.0 License](https://LICENSE).
