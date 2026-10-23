# Test Report

## Tooling stage

The backend health endpoint was tested test-first. Before adding the route,
`npm.cmd test` failed as expected: `GET /health` returned 404 instead of 200.
After adding the route and CORS configuration, the backend test passed.

Commands run from the repository root:

| Command | Result |
| --- | --- |
| `Set-Location .\backend; npm.cmd run typecheck; if ($?) { npm.cmd test }` | Typecheck succeeded; 1 test file and 1 test passed. |
| `Set-Location .\backend; npm.cmd run build` | TypeScript production build succeeded. |
| `Set-Location .\frontend; npm.cmd run typecheck; if ($?) { npm.cmd test }; if ($?) { npm.cmd run build }` | Typecheck succeeded; 1 test file and 1 test passed; production build succeeded. |

Frontend production output: `dist/index.html` (0.46 kB), CSS (7.19 kB), and
JavaScript (258.08 kB); Vite reported `built in 301ms`.

## Persistent database foundation

Database configuration and migration tests were run before their
implementations and failed because the modules did not yet exist. After
implementation, backend typecheck, build, and all tests passed.

The version 001 migration was applied to both the development and test
databases on a running PostgreSQL instance. The initial admin seed attempt
failed because the configured password was shorter than the required 12
characters. This was corrected, and the seed then succeeded. No credentials
or admin identifiers are included here.

Commands and actual outcomes from Windows Command Prompt, run from `backend/`:

| Command | Result |
| --- | --- |
| `npm.cmd run db:migrate` | Applied migration 001 (development). |
| `npm.cmd run db:migrate:test` | Applied migration 001 (test). |
| `npm.cmd run seed:admin` (first attempt) | Failed validation because `ADMIN_SEED_PASSWORD` was shorter than 12 characters; resolved by correcting the password. |
| `npm.cmd run seed:admin` (after correction) | Succeeded: `Initial ADMIN account is ready.` |
| `npm.cmd test` | Passed: 4 test files, 7 tests, duration 1.49 seconds. |

Passing test files: `migrations.test.ts` (2 tests),
`database-config.test.ts` (3 tests), `seed-admin.test.ts` (1 test), and
`app.test.ts` (1 test). These passing tests cover the database foundation and
health endpoint.

## Authentication integration tests — 24 October 2026

**INTENTIONAL FAILING TEST RUN (RED phase; authentication is not implemented).**

Command run from `backend/`:

```text
npm.cmd test
```

Actual result:

```text
Test Files  4 passed, 1 failed (5 total).
Tests       7 passed, 11 failed (18 total).
Duration    1.04 seconds.
```

The four existing database foundation and `GET /health` test files passed.
All 11 tests in `src/auth.integration.test.ts` failed: the requests received
HTTP 404 because the authentication endpoints and protected vehicle route
have not been implemented. No database connection or test import error
occurred.

The intended behaviors are: successful USER registration with a token;
case-insensitive duplicate-email rejection; invalid email rejection; invalid
password rejection; preventing ADMIN registration; successful login with a
token; unknown-email rejection; wrong-password rejection; and protected-route
rejection for a missing, invalid, or expired token. The test code configures
its pool with the explicit `test` database target and cleans up its uniquely
named test users and associated purchases after each test. Login tests that
depend on registration stopped at their registration setup assertion during
this RED run; their login-specific assertions were exercised in the
subsequent GREEN run below. Vehicle API and purchase behavior remain
unimplemented and untested.

## Authentication implementation — GREEN phase

After implementing registration, login, and authentication middleware, the
focused integration tests and full backend suite passed. A shared credential
parser was extracted for the register and login routes, then checks were
rerun.

Commands run from `backend/`:

| Command | Result |
| --- | --- |
| `npm.cmd test -- src/auth.integration.test.ts` | Passed: 1 test file, 11 tests. |
| `npm.cmd test` | Passed: 5 test files, 18 tests, duration 1.69 seconds. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run build` | Passed. |

Authentication tests cover registration, login, role assignment, validation,
password-hash omission from responses, and rejection of missing, invalid, or
expired tokens. Vehicle API and purchase behavior remain unimplemented and
untested.
