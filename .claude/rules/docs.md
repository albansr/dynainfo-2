# Docs — dynainfo-2

How we write feature documentation: a **PRD** (what/why) and a **TDD** (how), plus general doc style.

## Where

- Feature docs live under **`docs/features/`**. Each feature gets its own folder `docs/features/<slug>/` (kebab-case) with `prd.md` and `tdd.md`.
- Each is a living document with a one-line header: `> Living document · <date> · DynaInfo 2.0`.

## PRD vs TDD — don't mix

- **PRD = what & why.** Problem, user, outcomes, metrics. No solution detail.
- **TDD = how.** Architecture, data model, endpoints, screens, components, tests.
- Keep screens, endpoints, component choices and exact copy in the **TDD** — never in the PRD.

## PRD structure

Summary (one line) · Problem · Goal · User · What it lets you do · Model (in simple terms) · Guiding principle(s) · Out of scope · Success metrics · Acceptance criteria.

## TDD structure

Context · Goals & non-goals · Architecture decision + alternatives (with cost) · Data model · Backend design · Frontend design · Screens (UX) · Authorization & security · Testing strategy · Rollout plan · Glossary.

The **Screens (UX)** section must pin down the details that otherwise cause rework — agree them up front, don't leave them to the implementer:

- **Language and microcopy:** UI is in Spanish (see `frontend.md`); note key strings, grammatical gender, and the exact copy for empty/error/loading states.
- **Row actions & row-click:** inline buttons vs. a kebab menu; whether a whole row is clickable and where it navigates (e.g. drill to `/distribucion/detalle`).
- **Disabled/guarded states:** when a control is disabled and the tooltip that explains why.
- **Confirmation and feedback:** which actions confirm in a dialog, and the toast (sonner) on success/error.

## Style

- **English. No icons or emojis.**
- Clear and simple: short-to-medium sentences, concrete, professional — not salesy.
- Prefer plain-language explanations and a small glossary over jargon.
- Reference, don't duplicate: link to `CLAUDE.md` and `.claude/rules/*` for detail.

## Workflow

- **`/feature`** and **`/implement`** drive the PRD → TDD → implementation flow from `docs/features/`.
- Don't commit docs unless the user asks (see `git.md`).
