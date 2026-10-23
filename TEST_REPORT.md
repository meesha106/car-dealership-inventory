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
