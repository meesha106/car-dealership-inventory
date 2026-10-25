# AI Prompts and Logs

Add raw AI prompts and responses used for this assignment, or links to public
chat transcripts, as the work progresses. Do not add fabricated logs or private
credentials.

Prompt 1:
This is the task given by the company for the selection process, Give me step by step process to complete the task. Give the prompts to be given to AI as a prompt engineer to build a proper working application. Also give the proper API endpoints and databases as mentioned in the file. Also include steps in which the project should be completed and in a proper neat way as if done by a Senior Software developer.

Prompt 2:
I want prompts from the scratch including making of folders, files and all the features required and the packages and libraries as well.

Prompt 3:
You are my coding partner for a company TDD assignment. Start from this empty folder and build a Car Dealership Inventory System in small, test-first stages.

Mandatory stack:
- Backend: Node.js, TypeScript, Express, PostgreSQL, node-postgres (pg).
- Frontend: React, TypeScript, Vite, HTML5, CSS3, Tailwind CSS.
- Testing: Vitest and Supertest for the backend; Vitest and React Testing Library for the frontend.
- Use npm and commit the package-lock.json files.

Required API paths:
POST /api/auth/register
POST /api/auth/login
POST /api/vehicles
GET /api/vehicles
GET /api/vehicles/search
PUT /api/vehicles/:id
DELETE /api/vehicles/:id
POST /api/vehicles/:id/purchase
POST /api/vehicles/:id/restock

Product rules:
- Registration creates USER accounts only.
- Provide a local seed command for the first ADMIN. Never accept role=ADMIN from registration.
- Every vehicle route needs a valid token.
- USER and ADMIN can list, search, and purchase.
- ADMIN can add, update, delete, and restock.
- Each purchase buys one unit.
- Restock takes a positive integer quantity.
- Keep zero-stock vehicles in listings so the Purchase button can be visibly disabled.
- Record successful purchases in the database.
- A purchase must never make stock negative, including when requests arrive simultaneously.

The assignment requires a real database, React SPA, responsive UI, red-green-refactor commit history, README with setup and screenshots, a test report, a "My AI Usage" section, and a root PROMPTS.md with raw AI logs or public chat links.

Work rules:
1. Do only the stage I ask for. Do not implement later features early.
2. For each backend feature, write and run failing tests before implementation; show actual output. Then make them pass and show actual output.
3. Do not claim a test passed unless you ran it.
4. Never fabricate screenshots, commits, test results, or AI logs.
5. Explain every installed package briefly.
6. Never put passwords, tokens, or database secrets in tracked files.
7. Do not commit, push, or deploy for me.
8. After each stage, report changed files, commands run, results, and the next small step.

For this stage ONLY:
- Inspect the empty folder.
- Initialize Git if needed.
- Create the root folder structure, root README outline, .gitignore, .env.example, PROMPTS.md placeholder, and TEST_REPORT.md placeholder.
- Create backend/ and frontend/ folders, but do not implement features yet.
- Show the resulting directory tree.
- Explain the intended build order.

Prompt 4:
Continue in the existing repository. This stage is tooling and packages only.

Set up backend/ as a TypeScript Express application. Install and configure:

Runtime packages:
- express: API server
- pg: PostgreSQL client
- dotenv: local environment variables
- cors: allow the local frontend origin
- helmet: HTTP security headers
- zod: request and environment validation
- argon2: password hashing
- jsonwebtoken: signed authentication tokens

Development/test packages:
- typescript
- tsx: run TypeScript during development
- vitest
- @vitest/coverage-v8
- supertest
- @types/node
- @types/express
- @types/pg
- @types/cors
- @types/jsonwebtoken
- @types/supertest

Scaffold frontend/ using the current Vite React TypeScript template. Install and configure:
- react-router-dom: login, registration, dashboard routes
- tailwindcss and @tailwindcss/vite: Tailwind integration
- vitest
- jsdom
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event

Use the current package documentation if an installation instruction has changed. Do not hardcode guessed package versions. Do not mix incompatible ESM and CommonJS configurations.

Add package scripts for dev, build, typecheck, tests, and coverage as appropriate. Add a minimal Express GET /health response and a minimal React page saying the app is running. Configure CORS for the frontend development URL through environment settings.

Run installation, backend typecheck, frontend typecheck, backend tests if any, and frontend build. Give the exact commands and actual outputs. Do not implement authentication or inventory yet.

Prompt 5:
Implement the persistent database foundation. Do not implement HTTP feature endpoints yet.

Create:
- docker-compose.yml with a PostgreSQL service and a persistent named volume for local development.
- A separate test database configuration. Tests must never use the development database.
- backend/src/db/ connection pool.
- Versioned SQL migration files and an npm script that applies them in order and tracks applied migrations. Do not silently rerun an already applied migration.
- An explicit seed:admin npm command that creates or updates the initial ADMIN from local environment variables, with a hashed password. It must be safe to rerun.
- .env.example entries for database connection, test database connection, JWT secret, frontend origin, server port, and admin seed email/password placeholders. Never commit a populated .env.

Database schema:
users:
  id UUID primary key
  email unique and normalized
  password_hash
  role restricted to USER or ADMIN, default USER
  created_at

vehicles:
  id UUID primary key
  make
  model
  category
  price NUMERIC(12,2), nonnegative
  quantity integer, nonnegative
  created_at
  updated_at

purchases:
  id UUID primary key
  user_id referencing users
  vehicle_id nullable, referencing vehicles with deletion behavior that preserves history
  vehicle make/model and price snapshots
  purchased_at

Add database constraints, appropriate indexes, and a brief explanation of each. Ensure a vehicle can be deleted while existing purchase history remains useful.

Run PostgreSQL, apply migrations, seed an admin, and verify the tables and role. Show the actual commands and output. Do not print credentials. Provide fresh-machine setup instructions for README.

Prompt 6:
Implement ONLY the RED phase for authentication.

Create real HTTP integration tests with Supertest against the exported Express app and the separate PostgreSQL test database. Arrange for test data cleanup/isolation.

Write tests for:
- valid registration creates a USER and returns a token;
- duplicate email is rejected, including case variations;
- invalid email and invalid password are rejected;
- registration cannot create an ADMIN even if role is sent;
- valid login returns a token;
- wrong email or password is rejected;
- password_hash is never present in API responses;
- protected route rejects a missing token;
- protected route rejects an invalid or expired token.

Do not implement the auth endpoints yet. Run the tests and show their actual failures. Failures must come from missing behavior, not a broken test setup or unavailable database. Report changed files.

Prompt 7:
Implement the minimum backend code needed to make the existing authentication tests pass.

Implement:
POST /api/auth/register
POST /api/auth/login

Use Zod validation, parameterized PostgreSQL queries, Argon2 password hashing, a signed JWT with an expiry, authentication middleware, role middleware, and consistent error responses. Registration must ignore or reject a supplied role and always create USER.

Return a public user object containing id, email, and role; never return password_hash.

Keep app.ts importable by tests without opening a network port. Separate routes/controllers from business logic and database queries, but avoid needless abstraction.

Run the authentication tests, full backend tests, and typecheck. Report actual results. If any test fails, fix the cause and rerun. Then describe one sensible refactor, perform it if needed, and rerun tests.

Prompt 8:
Implement list and search in a RED-GREEN-REFACTOR sequence.

First write and run failing integration tests for:
- GET /api/vehicles requires a valid token;
- empty database returns an empty list;
- vehicles are listed with id, make, model, category, price, and quantity;
- zero-stock vehicles still appear;
- GET /api/vehicles/search filters by make, model, category, minPrice, maxPrice;
- multiple search filters work together;
- text matching is case insensitive;
- invalid price values and minPrice > maxPrice return 400.

After showing actual failing results, implement both endpoints with parameterized SQL and validated query parameters. Use a predictable sort order. Register /api/vehicles/search before a future /api/vehicles/:id route so "search" cannot be mistaken for an ID.

Run tests and typecheck. Report changed files and actual results.

Prompt 9:
Implement admin vehicle management using tests first.

Write and run failing integration tests for:
- ADMIN can POST /api/vehicles;
- valid vehicle has generated unique ID;
- ADMIN can PUT /api/vehicles/:id to update make, model, category, and price;
- PUT does not modify quantity; stock changes go through purchase/restock;
- ADMIN can DELETE /api/vehicles/:id;
- USER receives 403 on add, update, and delete;
- missing/invalid token receives 401;
- invalid/missing fields, negative price, negative quantity, decimal quantity, and malformed ID receive 400;
- unknown ID receives 404;
- deleted vehicle is no longer listed.

Then implement the minimum code to pass. Use server-side validation and database constraints. Keep responses consistent. Run the complete backend suite and typecheck, reporting actual results.

Add a README design note: the assignment labels add/update as "protected" and explicitly labels delete/restock as "Admin only"; this implementation also restricts add/update to ADMIN as a documented product decision.

Prompt 10:
Implement POST /api/vehicles/:id/purchase test first. One request buys exactly one vehicle.

Write and run failing integration tests for:
- purchase with valid token reduces stock by one;
- a purchase row is saved with user and vehicle/price snapshots;
- zero stock returns 409 without creating a purchase;
- unknown vehicle returns 404;
- malformed ID returns 400;
- no token returns 401;
- when two requests concurrently try to buy the final unit, exactly one succeeds and stock ends at zero;
- if inserting the purchase row fails, the stock decrement is rolled back.

Implement a single conditional SQL update:
UPDATE vehicles
SET quantity = quantity - 1, updated_at = NOW()
WHERE id = $1 AND quantity > 0
RETURNING ...;

Insert the purchase row in the SAME transaction on the SAME PostgreSQL client. Commit only after both operations succeed; rollback on error. Distinguish missing vehicle from out-of-stock vehicle when the update returns no row.

Do not use a read-quantity/subtract/write sequence. Do not replace the concurrent integration test with mocks. Run the full backend test suite and typecheck; show actual output.

Prompt 11:
Implement POST /api/vehicles/:id/restock using tests first.

Request body: { "quantity": positive integer }.

Write and run failing tests for:
- ADMIN restocks by the specified amount;
- stock is persisted after a new database read;
- USER receives 403;
- missing token receives 401;
- quantity 0, negative, decimal, string, or missing receives 400;
- unknown vehicle receives 404;
- concurrent restocks do not lose increments.

Implement an atomic database increment and return the updated vehicle. Run the full backend suite, coverage, and typecheck. Report actual numbers and any uncovered behavior; do not invent a coverage percentage.

Prompt 12:
Build the frontend against the REAL running backend. Do not use permanent mocked inventory.

Create:
- typed API client and request/response types;
- registration page;
- login page;
- authenticated route handling;
- dashboard with vehicle cards or a clear inventory table;
- loading, empty, error, and unauthorized states;
- logout;
- responsive layout using Tailwind, HTML5, and accessible form controls.

Attach the token to protected requests. If the token is invalid or expired, clear the session and send the user to login. Do not print the token in the UI or console.

Build and test in small pieces. Add useful frontend tests for forms, authentication navigation, and inventory loading. Run tests, typecheck, and build; report actual output.

Make the UI visually coherent: consistent spacing, type scale, buttons, form errors, and mobile layout. Avoid adding decorative features that do not help the task.

Prompt 13:
Extend the existing React dashboard.

Add search/filter inputs for make, model, category, minimum price, and maximum price, calling GET /api/vehicles/search with only provided parameters.

Add a Purchase button on every vehicle:
- disabled when quantity is zero;
- disabled while its purchase request is running;
- shows a clear success or error message;
- refreshes inventory from the server after success;
- handles a 409 conflict if someone else bought the last unit.

Add frontend tests for filtering, the disabled zero-stock button, purchase success, and 409 feedback. Run tests, typecheck, and build. Show actual results. Do not let the frontend assume a purchase succeeded before the server confirms it.

Prompt 14:
Add an ADMIN-only inventory management area to the React SPA.

It must include:
- form to add a vehicle;
- form to edit make, model, category, and price;
- delete action with confirmation;
- restock action requiring a positive integer;
- immediate refresh of displayed inventory after successful operations;
- validation messages and server error messages.

Hide admin controls for USER, but remember the backend must independently enforce the role. Add frontend tests showing USER cannot see admin controls and ADMIN can use them.

Run frontend tests, backend tests, both typechecks, and the frontend production build. Show actual results and fix any failures.

Prompt 15:
Act as a senior reviewer of this repository. First review without changing code.

Check every assignment requirement and trace it to a file and a test. Pay special attention to:
- permissions and public admin registration;
- database persistence;
- purchase concurrency and rollback;
- correct 400/401/403/404/409 responses;
- search combinations;
- zero-stock button;
- responsive and keyboard-friendly UI;
- leaked secrets or password hashes;
- repeatable setup from a fresh clone;
- test isolation.

Return a table: requirement, implementation location, test/evidence, missing issue, severity. Separate confirmed defects from optional improvements.

After I review the table, fix confirmed defects in small steps with tests. Do not invent test results.

Prompt 16:
Finish the submission material using the ACTUAL project and actual command output.

Complete README.md with:
- project overview and architecture;
- technology choices;
- prerequisites;
- exact local setup from a fresh clone;
- PostgreSQL startup, migration, and admin seed instructions;
- backend and frontend startup instructions;
- environment variable descriptions;
- API table with access rules and example requests;
- test commands;
- documented interpretation of add/update permissions;
- screenshots of the final app in action;
- a section titled exactly "My AI Usage".

Create or complete TEST_REPORT.md with the actual date, commands run, pass/fail counts, coverage if actually measured, and known limitations. Do not fabricate results.

Check the root PROMPTS.md. The assignment requires raw, unedited AI chat logs or public chat links, not an AI-written summary. Tell me which conversations I still need to paste/link. Do not replace raw logs with your own summary.

Give me a final submission checklist. Do not claim the repository is ready unless tests, build, screenshots, README, TEST_REPORT.md, PROMPTS.md, and Git history have actually been checked. Do not push or deploy.

Conversation link:
https://chatgpt.com/share/e/6add9d73-ee60-834f-a55e-e0a633abba25