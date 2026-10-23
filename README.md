# Car Dealership Inventory System

## Overview

An inventory management application with a Node.js/TypeScript/Express API,
PostgreSQL persistence, and a React/TypeScript single-page application.

## Requirements

- Node.js and npm
- Docker with Docker Compose

## Setup

1. Copy `.env.example` to `.env` in the repository root and replace every
   placeholder with local values. Keep `.env` untracked.
2. Start PostgreSQL and create the separate test database:

   ```sh
   docker compose up -d
   ```

   The `postgres_data` named volume preserves local database data. On the first
   initialization, Compose creates `car_dealership` and
   `car_dealership_test`; the test database is separately configured and
   backend test connections reject a matching development database identity.
3. Install dependencies separately in each application:

   ```sh
   cd backend
   npm ci
   cd ../frontend
   npm ci
   ```

4. From `backend/`, apply the schema and seed the initial administrator:

   ```sh
   npm run db:migrate
   npm run seed:admin
   ```

   Set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` in the root `.env` first.
   The seed command hashes the password and safely creates or updates that
   account as an ADMIN.

The backend reads the root `.env`; CORS uses `FRONTEND_ORIGIN`.

## Development

Run `npm run dev` in `backend/` and `frontend/` in separate terminals. Each
application provides `build`, `typecheck`, and `test` scripts. The backend also
provides `coverage`, `db:migrate`, `db:migrate:test`, and `seed:admin` scripts.
Backend tests and test migrations use `TEST_DATABASE_URL`, never the
development URL. The test database can be migrated separately with
`npm run db:migrate:test`.

## Database schema

Migrations are versioned SQL files under `backend/migrations/`. The migration
runner records version, filename, checksum, and application time in
`schema_migrations`; it skips matching applied versions and fails if an
applied migration has been edited. Each migration runs transactionally under a
PostgreSQL advisory lock.

- `users` stores normalized, unique email addresses and password hashes. A
  check constraint limits roles to `USER` or `ADMIN` and defaults new users to
  `USER`.
- `vehicles` stores nonnegative `NUMERIC(12,2)` prices and nonnegative integer
  quantities; required text fields cannot be blank.
- `purchases` stores the buyer, purchase time, and vehicle make/model/price
  snapshots. Its nullable vehicle foreign key uses `ON DELETE SET NULL`, so
  deleting a vehicle preserves useful purchase history. Buyer deletion is
  restricted while purchase history refers to that user.
- A unique constraint/index on user email enforces uniqueness. The vehicle
  make/model and category indexes support case-insensitive filtering; purchase
  indexes support customer and vehicle history ordered by purchase time.

## Vehicle management authorization

The assignment labels vehicle add/update as "protected" and explicitly labels
delete/restock as "Admin only." This implementation restricts add, update, and
delete to ADMIN accounts as a documented product decision; inventory changes
remain unavailable to USER accounts.

## API

_API documentation will be added as endpoints are implemented._

## Screenshots

_Add genuine application screenshots after the UI is implemented._

## Test Report

See [TEST_REPORT.md](./TEST_REPORT.md).

## My AI Usage

_Document AI assistance used for this assignment, including how suggestions were
reviewed and verified._

## Build Order

The staged build order is tracked in the project conversation and will be
documented here as each stage is completed.
