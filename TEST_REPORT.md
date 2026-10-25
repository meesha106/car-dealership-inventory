# Test Report

## Latest verified snapshot — 24–25 October 2026

The tests, coverage, migrations, frontend typecheck/build, and most recent
backend typecheck were run against this working tree on 24 October 2026.
Backend production build was rerun on 25 October 2026. PostgreSQL was running
for the integration suite, which connected to the configured test database.
No credentials, tokens, or account identifiers are recorded.

Commands run from `backend/`:

| Command | Actual result |
| --- | --- |
| `npm.cmd test` | Passed: 9 test files, 71 tests; duration 3.77 seconds. |
| `npm.cmd run coverage` | Passed: 9 test files, 71 tests; duration 2.35 seconds. Statements 81.46% (233/286), branches 76.85% (83/108), functions 88.88% (40/45), lines 81.33% (231/284). |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run build` (25 October) | Passed: `tsc -p tsconfig.json`. |
| `npm.cmd run db:migrate` | Schema is up to date (development). |
| `npm.cmd run db:migrate:test` | Schema is up to date (test). |

Commands run from `frontend/`:

| Command | Actual result |
| --- | --- |
| `npm.cmd test` | Passed: 2 test files, 18 tests; duration 8.00 seconds. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run build` | Passed: Vite transformed 38 modules; build completed in 366 ms. Output: `dist/index.html` 0.46 kB, CSS 23.56 kB, JavaScript 285.34 kB. |

The genuine local screenshots in `screenshots/` were captured from the
running frontend and backend. A short-lived signed ADMIN preview token and
demonstration vehicle were created for the capture; the temporary vehicle was
removed and a database query confirmed zero matching fixture rows afterward.
The screenshots are not automated test evidence and do not replace the
API/integration tests.

Known limitations:

- Backend integration tests require PostgreSQL. They passed in this run; if
  PostgreSQL is unavailable, these suites fail during setup rather than
  providing a useful offline substitute.
- Coverage is measured for the backend only. The reported uncovered behavior
  remains visible in Vitest's coverage report, especially migration-runner
  paths and some middleware/route branches.
- The committed Git history does not currently demonstrate a complete
  red-green-refactor commit sequence. No commits were created during this
  submission-material pass.
- `PROMPTS.md` contains user prompt text, not complete raw assistant/user chat
  transcripts or public transcript links. The README's AI-usage section is a
  summary and does not satisfy the raw-log requirement.
- Screenshots are local desktop captures; no separate mobile screenshot or
  automated viewport-specific visual test was recorded.

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

## Authentication integration tests — RED phase — 24 October 2026

### Intentional failing test run

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
At that stage, all 11 tests in `src/auth.integration.test.ts` failed: the
requests received HTTP 404 because the authentication endpoints and protected
vehicle route had not yet been implemented. No database connection or test
import error occurred.

The intended behaviors are: successful USER registration with a token;
case-insensitive duplicate-email rejection; invalid email rejection; invalid
password rejection; preventing ADMIN registration; successful login with a
token; unknown-email rejection; wrong-password rejection; and protected-route
rejection for a missing, invalid, or expired token. The test code configures
its pool with the explicit `test` database target and cleans up its uniquely
named test users and associated purchases after each test. Login tests that
depend on registration stopped at their registration setup assertion during
this RED run; their login-specific assertions were exercised in the
subsequent GREEN run below. At that stage, vehicle API and purchase behavior
had not yet been implemented or tested.

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
expired tokens. Vehicle list/search and admin-management APIs are documented
in the sections below. At that stage, purchase behavior had not yet been
implemented or tested.

## Admin vehicle management — RED-GREEN

Before implementation, the new admin-management integration tests were run
against the test database. They failed on missing routes and behavior; the
existing token rejection checks passed. The actual RED result was 1 test file,
19 failed and 4 passed (23 total).

After implementing create, update, and delete, the focused management suite
passed: 1 test file, 22 tests. An initial full-suite run reported 51 passed
and 2 failed because the concurrent vehicle-list/search and management test
files used the same test database fixtures. Both vehicle integration suites
now serialize fixture access using a PostgreSQL advisory lock.

**Test-count discrepancy for review:** the recorded RED result is 23 tests
(19 failed and 4 passed), while the recorded GREEN result is 22 tests. The
current and committed `vehicle-management.integration.test.ts` each contain
22 test cases when parameterized cases are counted individually. No earlier
RED-version test source or complete RED output is preserved in the repository,
so the evidence does not establish whether one case was removed/combined or
whether the RED count was recorded incorrectly. Both historical results are
retained as reported; verify the original RED run before explaining the
difference as a test change.

Final commands run from `backend/`:

| Command | Result |
| --- | --- |
| `npm.cmd test -- src/vehicle-management.integration.test.ts` | Passed: 1 test file, 22 tests. |
| `npm.cmd test` | Passed: 7 test files, 53 tests, duration 1.70 seconds. |
| `npm.cmd run typecheck` | Passed. |
| Test database fixture check | Passed: no `vehicle-admin-it-` or `vehicle-it-` fixture rows remained. |

Creation, update, and delete require ADMIN. Updates accept make, model,
category, and price; quantity is not updated by this endpoint.

## Vehicle purchase — RED-GREEN

The first attempted RED run could not connect to PostgreSQL, so it did not
reach the tests. After Docker Desktop was started and the test database was
reachable, the purchase integration tests ran against the real test database.
Before implementation, 5 tests failed with 404 for the missing purchase
endpoint and 2 passed (the existing unknown-ID and missing-token guards).

The purchase endpoint uses a conditional stock decrement and inserts the
purchase snapshot through the same PostgreSQL client and transaction. The
integration tests include two simultaneous requests for the final unit and a
real PostgreSQL trigger that forces the purchase insert to fail, verifying
stock rollback.

Commands run from `backend/`:

| Command | Result |
| --- | --- |
| `npm.cmd test -- src/purchase.integration.test.ts` (before implementation, with PostgreSQL running) | RED: 1 test file, 5 failed, 2 passed. |
| `npm.cmd test -- src/purchase.integration.test.ts` (after implementation) | Passed: 1 test file, 7 tests. |
| `npm.cmd test` | Passed: 8 test files, 60 tests, duration 1.50 seconds. |
| `npm.cmd run typecheck` | Passed. |
| Purchase fixture/trigger check | Passed: no purchase test users or vehicles remained; temporary trigger and function were absent. |

The tests verify one-unit stock reduction, purchase user and vehicle/price
snapshots, out-of-stock and missing-vehicle responses, malformed IDs,
authentication, concurrent final-unit purchasing, and rollback after an
insert failure.

## Vehicle restock — RED-GREEN

Before implementation, the restock integration suite ran against PostgreSQL:
1 test file, 9 failed, and 2 passed. Failures were due to the missing restock
route; existing unknown-vehicle and missing-token behavior passed.

After adding ADMIN-only validation and an atomic database quantity increment,
the focused suite passed 11 tests. Full backend verification:

| Command | Result |
| --- | --- |
| `npm.cmd test -- src/restock.integration.test.ts` (before implementation) | RED: 1 test file, 9 failed, 2 passed (11 total). |
| `npm.cmd test -- src/restock.integration.test.ts` (after implementation) | Passed: 1 test file, 11 tests. |
| `npm.cmd test` | Passed: 9 test files, 71 tests, duration 3.70 seconds. |
| `npm.cmd run coverage` | Passed: 9 test files, 71 tests, duration 3.59 seconds. |
| `npm.cmd run typecheck` | Passed. |

Coverage reported by Vitest V8: statements 81.46% (233/286), branches 76.85%
(83/108), functions 88.88% (40/45), and lines 81.33% (231/284). Uncovered
lines include migration-runner paths, some authentication/error middleware
branches, and a few vehicle route/service branches. Behavior not exercised
by this stage's restock tests includes quantities near the PostgreSQL integer
limit and overflow handling. No coverage figures are inferred beyond the
reported output.

## React frontend — live API integration

The frontend now uses a typed API client for registration, login, inventory
search, and purchase requests. The dashboard requests live inventory from the
Express backend; the app contains no permanent mocked vehicle data. The
session token is attached to protected requests, kept out of the rendered UI
and console, and cleared with a redirect to login after a protected request
returns 401.

Frontend tests use request stubs only to verify form, navigation, session,
loading, empty, error, and inventory rendering behavior. The running app was
also verified against the real local API: registration succeeded, the
authenticated inventory request returned the real empty inventory, and
logout returned to login. Opening the app on `127.0.0.1` was rejected by the
configured CORS origin; using the documented `http://localhost:5173` origin
worked. The temporary live verification account was removed afterward.

Commands and actual results from `frontend/`:

| Command | Result |
| --- | --- |
| `npm.cmd test` | Passed: 1 test file, 9 tests. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run build` | Passed: 32 modules transformed; Vite build completed in 174 ms. |
| `npm.cmd run lint` | Passed with no warnings. |

The built files were `dist/index.html` (0.46 kB), CSS (20.42 kB), and
JavaScript (274.20 kB). The frontend tests stub API responses and do not
replace real inventory in the application.

### Dashboard search and purchase feedback

The dashboard tests verify that only provided search filters are sent to
`GET /api/vehicles/search`, zero-stock vehicles remain visible with a disabled
Purchase button, purchase stays pending until the API confirms success, and a
successful purchase refreshes inventory from the server. A 409 response shows
conflict feedback and refreshes inventory to reflect updated stock.

The first test run had 12 passing tests and 1 failing test: a successful
purchase did not trigger a server inventory refresh. After correcting that
behavior, final commands from `frontend/` produced:

| Command | Result |
| --- | --- |
| `npm.cmd test` | Passed: 1 test file, 13 tests, duration 4.79 seconds. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run build` | Passed: 32 modules transformed; Vite build completed in 182 ms. |

Final build output: `dist/index.html` (0.46 kB), CSS (20.45 kB), and
JavaScript (274.16 kB). Frontend component tests use test-only response stubs;
real inventory remains sourced from the backend.
