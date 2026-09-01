# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Read this first

**`hand-off.md` in the repository root holds the current state of the project.**
Read it at the start of every session — it says what is done, what is blocked
and on what, and which mistakes have already been made and fixed.

## Keeping hand-off.md current

**Update `hand-off.md` and commit it alongside the work, in the same commit,
whenever any of these happens:**

- An item on its "下一步" list is completed or moved forward → update the status
  table and the list
- CI or deployment status changes → update the status overview
- A new pitfall is hit and fixed → add it to "踩過的坑" as
  **symptom → cause → fix**
- The architecture changes materially → update the architecture notes

Always update the "最後更新" date and commit hash at the top.

Do not batch these up for the end of a session. A hand-off written after the
fact records what you remember; one written as you go records what happened.

Write the state as it actually is, not as it is hoped to be. If something is
blocked, say precisely what it is blocked on. The reader is someone with no
context at all.

## Commands

```bash
pnpm install
pnpm build        # must run before typecheck: apps/web imports the BUILT svgmotion
pnpm lint
pnpm typecheck
pnpm test         # core (111) + web (12)
pnpm test:e2e     # Playwright, against a production build
```

Where a Chromium is already installed:
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium pnpm test:e2e`

## Verifying CI problems

Local green is not CI green. This repository has already produced two failures
that were invisible locally. Before trusting a fix:

```bash
rm -rf packages/core/dist apps/web/dist   # reproduce a clean checkout
```

`apps/web` resolves `svgmotion` through its built output, so leftover `dist/`
from earlier work makes typecheck pass when it should not.

## Architecture rules that must hold

1. **`packages/core` has no UI dependencies.** That constraint is what makes it
   usable from a build script or a server, which is most of the reason it is
   published separately.
2. **Geometry is normalized once, during parsing** — every shape becomes
   absolute cubic bezier subpaths. Lottie can express nothing else, so
   decomposing there rather than at export time is what keeps all five
   exporters drawing the identical shape.
3. **Presets emit channels, not markup.** A channel is one animatable property
   with keyframes. Adding an effect must not mean editing five exporters.

`CONTRIBUTING.md` has the full steps for adding an effect.

## Conventions

- Conventional Commits (`feat(core):`, `fix(ci):`, `docs:`)
- Never state a model identifier in commits, PRs, or code comments
- Warnings are surfaced to the user, never swallowed. An export tool that
  silently drops a gradient teaches people not to trust its output.
- Prefer tests that parse the exported artefact and assert what is in it over
  tests that assert a button was clicked.
