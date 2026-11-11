# Codex instructions for gamification-1

## Scope and shared sources

These project rules apply to work on the application in this repository. For ordinary questions, status updates, or documents outside the repository, use the global working agreements without starting the development pipeline.

For code changes, read `CLAUDE.md` and the relevant part of `src/docs/dev-pipeline.md` once when needed. They are the shared project conventions; do not copy them into a second rulebook. Read `src/docs/<module>.md` and nearby implementation for the affected module, not every module. For UI work consult `src/docs/apex-ui-kit.md`; for data fetching consult `src/modules/cache/README.md`; for code review consult `src/docs/code-review.md`.

Apply the Codex adaptations below when those shared sources disagree. Explicit user instructions and the global Git and database safeguards remain in force. Do not modify Claude's files merely to configure Codex.

## Workflow: question, Quick, or Full

- Questions and read-only investigations: answer or investigate only the requested point. No implementation, plan files, or reviewer delegation by default.
- Quick Pipeline: a local bug fix, existing component/hook/action, or focused UI change. Inspect the relevant code, state the intended change, implement the smallest fix, run proportionate checks, and report the result.
- Full Pipeline: a new module, architecture/integration/schema change, broad feature, or work needing substantial decomposition. Investigate, present one numbered plan with affected areas, ordered stages, dependencies, risks, acceptance criteria and checks; obtain approval before persistent changes.
- Quick/Full selects the execution workflow; it does not waive global approval requirements. In particular, changes to more than two related files or material behavior/data changes require a plan under the global agreement.
- Once approved, keep the plan as the active contract: show completed/current/remaining stages, incorporate user corrections, and continue without asking for the same approval at each routine step. Obtain approval for changed scope or material risk.
- For a Full feature, save the approved plan under `src/docs-features/<module>/` when useful. Keep one current plan, including implementation progress and actual verification. Present an unapproved plan in chat first.
- At each stage, run the applicable type/build/lint or focused behavior checks. For UI, check the user-facing path, responsive layout, loading, empty, error and permission states as relevant. Do not claim checks that were not performed. Finish with completed work, verification and remaining limitations.
- Git remains strictly read-only. Branches, commits, staging, push, merge and worktrees in the shared pipeline are manual user steps, not commands Codex may execute.

## Resolve the existing source conflicts

- Versions and installed dependencies: `package.json` and the lockfile describe the current stack; old Next.js 15 references are not an instruction to downgrade. Never add Zod, react-hook-form, Sentry or another dependency just because an old agent template mentions it. Explain a required dependency change and obtain approval first.
- File names: follow `CLAUDE.md`, `code-review.md`, and the established pattern of the touched module. Components use PascalCase; hooks use their existing `use...` convention. Do not apply the old agent's blanket kebab-case rule or rename unrelated working files.
- Cache: use the existing `@/modules/cache` public API, query keys and mutation factories where the feature needs client data. Do not introduce a parallel cache, one-off factories or extra state layers. Handle authentication, authorization, validation, errors and invalidation appropriate to the operation.
- Optimistic updates: use them where the existing mutation pattern and reversible behavior support them; a justified refetch is sufficient for other cases. Do not force optimistic behavior on sensitive or irreversible operations.
- UI: reuse actual project components and Apex tokens. The old modal agent's Resource Graph dark/amber palette is not this project's design system. Locate real primitives before proposing a path; do not assume `components/modals` or `modules/modals` exists.
- Simplicity: extract genuinely shared logic when that helps the current task. A second similar line, a component crossing an arbitrary line count, or a theoretical style preference alone is not a reason to add abstractions or refactor outside scope.
- Documentation: update module docs when behavior, interfaces, configuration or important invariants change. Do not rewrite docs after a purely internal or cosmetic edit.
- Knowledge graph: consult `graphify-out/` for cross-module investigation if present. If absent, use targeted search and code reads; do not install graph tools or pretend a graph query ran. Treat Claude slash commands as tool-specific, not available Codex commands.
- Memory is historical context, not authorization or verified production state. Do not import the entire Claude memory store; verify relevant facts and never reproduce a workaround that bypasses an approval or safety restriction.

## Focused reviewer routing

Profiles are in `.codex/agents/*.toml`. They inherit the current model and reasoning effort. Reviewers return findings and do not edit files or change data. The main agent owns implementation and the plan.

| Reviewer | Invoke when |
|---|---|
| `pragmatic_architect` | A Full plan introduces architecture, a dependency, a new service/state layer, or meaningful complexity; review before presenting it for approval |
| `cache_guardian` | Changes affect actions, queries, cache keys, mutation invalidation, auth-sensitive data fetching or realtime |
| `clean_code_guardian` | A new component/module or substantive refactor needs a focused structure/type review; not for cosmetic changes or line count alone |
| `modal_architect` | Creating or substantially changing a modal/dialog and its form/interaction flow |
| `sentry_guardian` | Explicit observability work, an error investigation, or changed critical paths in a project with Sentry already configured |

Use the reviewers relevant to the changed behavior; do not run all five for every task. For small reversible changes, perform a focused main-agent check when a separate review adds no useful evidence. Do not create repeat review loops without new changes or an unresolved finding. Do not delegate overlapping edits.

Give a reviewer the exact scope, paths, intended behavior and relevant shared documentation. Ask for concrete findings with file/line evidence, impact and the smallest correction. Resolve findings before marking the stage complete. A skipped or unavailable review is not a passed review: report unavailable roles/tools and state which checks were actually done.

## Final report

Report the result, completed plan stages, checks actually performed and any residual risk. For user-facing changes, state the path/scenario that was checked; if live verification is unavailable, give a short manual checklist with expected results. Keep ordinary answers concise.
