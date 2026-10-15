> Living document · 2026-10-15 · DynaInfo 2.0

# Soporte (support requests)

## Summary

Let any DynaInfo user report a problem or ask for something from inside the app, with the context of what they were looking at captured automatically, and follow the request until it is solved.

## Problem

Today users report issues by chat or email, out of context: "the budget doesn't show" without saying which screen, filters, dates or role. Reproducing each report costs back-and-forth, requests get lost in personal inboxes, and nobody can see what is pending or what was solved. Users never learn whether their report was handled.

## Goal

Every request lands in one place with enough context to reproduce it at first sight, has a visible status, and the user is told when it is answered or solved, with no paid tool.

## User

- **Requesters:** every signed-in DynaInfo user (all roles). They report and follow their own requests.
- **Agents:** users whose real role from the Dyna SSO is `ADMIN`. They see every request, answer, prioritise and solve.
- **Notification recipient:** for now a single address, `alban.rodriguez95@gmail.com`, receives new requests and user replies by email.

## What it lets you do

- Open a request from any screen through an "Ayuda y soporte" entry at the foot of the side menu.
- Pick one of four types: app error, wrong data, access or permissions, suggestion.
- Send it with the screen's context attached automatically, and optionally a screenshot.
- See "Mis solicitudes" with the status of each one, and talk with the agent in a message thread.
- As an agent: see every request, filter it, set priority, write public replies or internal notes, mark it resolved and link the Novedades entry that solved it.
- As an agent: reopen the user's exact screen (same URL, filters and dates) in one click, and optionally view it as the user's role and scope.

## Model (in simple terms)

- **Request (ticket):** a numbered report (#1, #2…) from one user, with a type, a subject, a description, the captured context, an optional screenshot, a status and a priority.
- **Status:** Abierta → En curso → Resuelta → Cerrada. A resolved request closes by itself after 7 days unless the user replies, which reopens it.
- **Priority:** Alta, Media or Baja, set only by agents. New requests start at Media.
- **Message:** a reply in the request's thread, from the user or an agent. Agents can also write internal notes that the user never sees.
- **Context:** what the user was looking at when they opened the request: page and URL, filters, date range, role and scope, browser and screen size.

## Key decisions (from the interview)

| Decision | Choice |
|---|---|
| Build or buy | Build it inside DynaInfo (free, reuses the SSO, Postgres, Resend and Novedades) |
| Who handles requests | Users with real `dyna_role = ADMIN` |
| Conversation | Message thread in the app; every reply notifies the other side by email with a link back |
| Types | App error, wrong data, access/permissions, suggestion |
| Context | Captured automatically; screenshot optional, chosen by the user |
| Entry point | "Ayuda y soporte" at the foot of the side menu, on every screen (mobile too) |
| Screenshot storage | In Postgres, compressed (about 1 MB maximum) |
| New-request email | Only `alban.rodriguez95@gmail.com` for now |
| Priority | Set by agents only |
| Closing | Resolved closes automatically after 7 days; a user reply reopens it |
| Novedades | When resolving, an agent can link a Novedades entry; the user's email includes it |
| Agent extras | Internal notes, "open where the user was", "view as their role" |
| "View as their role" in production | Allowed only to users whose real role is ADMIN; lasts only for the browser tab and always shows a visible banner |
| Where users follow requests | A `/soporte` page ("Mis solicitudes"); agents see all requests on the same page |

## Guiding principles

- **Context over questions:** the request must be reproducible without asking the user what they were looking at.
- **Low friction:** opening a request takes under a minute and never leaves the current screen.
- **The user always knows where their request stands:** visible status and an email on each answer.
- **Free and in-house:** no external service beyond the email provider already in use.

## Out of scope

- Replying by email (inbound email parsing).
- Free file attachments beyond the single screenshot.
- SLAs, response-time targets and escalation rules.
- A knowledge base or self-service answers before opening a request.
- Assigning requests to a specific agent, or per-type routing.
- Support for people without a DynaInfo account.
- AI triage, duplicate detection or suggested answers.
- Server-side enforcement of role data filters for the rest of the app (still frontend-only; see `CLAUDE.md`).

## Success metrics

- At least 80 percent of requests can be reproduced without asking the user for more context.
- Median time to first agent reply under one business day.
- Fewer than 10 percent of resolved requests reopened by the user.
- After two months, most support contacts come through the app instead of chat or personal email.

## Acceptance criteria

1. Any signed-in user can open a request from any authenticated screen, choosing a type and writing a subject and description, without leaving the screen.
2. The request stores the context (URL, filters, date range, role and scope, browser, screen size) without the user typing it.
3. The user can choose to include a screenshot of the current screen; the support panel itself does not appear in it.
4. A new request sends an email to `alban.rodriguez95@gmail.com` with the number, type, subject, requester and a link to the request.
5. The user sees their own requests at `/soporte` with number, subject, type, status and last activity, and can open the thread and reply.
6. A user can never see another user's requests or any internal note.
7. An agent (real `ADMIN`) sees every request at `/soporte`, can filter by status, type and priority, and can change status and priority.
8. An agent's public reply emails the requester; a user's reply emails the notification address.
9. When an agent marks a request resolved, the requester gets an email, including a link to the chosen Novedades entry when one is linked.
10. A resolved request closes automatically 7 days later; a user reply before that reopens it.
11. An agent can open the user's screen with the same URL, filters and date range in one click.
12. An agent can view the app as the requester's role and scope, with a permanent banner and an exit; in production this works only for users whose real role is ADMIN, and it ends when the tab closes.
13. All support endpoints reject requests without a session (401), agent actions from non-agents (403), and other users' requests (404).

## Decisions still to validate

- Whether the notification address should become "all ADMIN users" once more people handle support.
- Whether 7 days is the right auto-close window.
- Whether "En curso" should notify the user (currently it does not, to avoid noise).
- Retention: how long closed requests and their screenshots are kept (currently forever).
