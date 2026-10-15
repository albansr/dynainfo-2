> Living document · 2026-10-15 (iteration 2) · DynaInfo 2.0

# Soporte (support requests)

## Summary

Let any DynaInfo user report a problem or ask for something from inside the app, with the context of what they were looking at captured automatically, and follow the request until it is solved.

## Problem

Today users report issues by chat or email, out of context: "the budget doesn't show" without saying which screen, filters, dates or role. Reproducing each report costs back-and-forth, requests get lost in personal inboxes, and nobody can see what is pending or what was solved. Users never learn whether their report was handled.

## Goal

Every request lands in one place with enough context to reproduce it at first sight, has a visible status, and the user is told when it is answered or solved, with no paid tool.

## User

- **Requesters:** every signed-in DynaInfo user (all roles). They report and follow their own requests.
- **Agents:** users whose real role from the Dyna SSO is `ADMIN`, or superadmins of DynaInfo. They see every request, answer, prioritise and solve.
- **Notification recipient:** for now a single address, `alban.rodriguez95@gmail.com`, receives new requests and user replies by email.

## What it lets you do

- Open a request from any screen through "Ayuda y soporte" at the foot of the side menu (Nueva solicitud), or straight from a figure with "¿Este dato no cuadra?".
- Pick one of four types (app error, wrong data, access or permissions, suggestion) and answer a question guided by the type; the subject is optional.
- Send it with the screen's context attached automatically, and a screenshot of what you were looking at that you can review or remove.
- Open "Mis solicitudes" from the same menu, see where each request stands and what to expect, and talk with the team in a chat-like thread. The menu shows when the team has replied.
- When a request is resolved, say with one click (in the app or from the email) whether it was solved or still happens.
- As an agent: open "Solicitudes" (under Ayuda y soporte) to see every request, ordered by those waiting for the team; filter, prioritise, answer with quick replies, write internal notes, reply and resolve in one step, and link the Novedades entry that solved it.
- As an agent: reopen the user's exact screen (same URL, filters and dates) in one click, optionally viewing it as their role and scope, and see the requester's other requests and those sent from the same screen.

## Model (in simple terms)

- **Request (ticket):** a numbered report (#1, #2…) from one user, with a type, a subject, a description, the captured context, an optional screenshot, a status and a priority.
- **Status:** Abierta → En curso → Resuelta → Cerrada. A resolved request closes by itself after 7 days unless the user replies or says it still happens, which reopens it. Shown to the user as Enviada → En revisión → Resuelta → Cerrada.
- **Whose turn:** a request waits either for the team or for the user; the team's list is ordered by it.
- **Satisfaction:** the user's answer to "¿Se solucionó?" on a resolved request.
- **Priority:** Alta, Media or Baja, set only by agents. New requests start at Media.
- **Message:** a reply in the request's thread, from the user or an agent. Agents can also write internal notes that the user never sees.
- **Context:** what the user was looking at when they opened the request: page and URL, filters, date range, role and scope, browser and screen size.

## Key decisions (from the interview)

| Decision | Choice |
|---|---|
| Build or buy | Build it inside DynaInfo (free, reuses the SSO, Postgres, Resend and Novedades) |
| Who handles requests | Users with real `dyna_role = ADMIN`, or superadmins (`user.role = superadmin`) |
| Conversation | Message thread in the app; every reply notifies the other side by email with a link back |
| Types | App error, wrong data, access/permissions, suggestion; a guided question per type; optional subject |
| Context | Captured automatically and described in plain words; screenshot taken when the form opens, reviewable and removable |
| Entry points | "Ayuda y soporte" at the foot of the side menu, with Nueva solicitud and Mis solicitudes; "¿Este dato no cuadra?" on every metric and table |
| Agents' inbox | "Solicitudes", under Ayuda y soporte (agents only), with the count of requests waiting for the team and tabs "Todas" / "Mis solicitudes"; for agents, Ayuda y soporte opens the form directly |
| Screenshot storage | In Postgres, compressed (about 1 MB maximum) |
| New-request email | Only `alban.rodriguez95@gmail.com` for now |
| Priority | Set by agents only |
| Closing | Resolved closes automatically after 7 days; a user reply or "Sigue pasando" reopens it; "Sí, cerrar" closes it |
| Novedades | When resolving, an agent can link a Novedades entry; the user's email includes it |
| Agent extras | Internal notes, quick replies, reply and resolve in one step, "open where the user was", "view as their role", related requests |
| "View as their role" in production | Allowed only to agents; lasts only for the browser tab and always shows a visible banner |
| Emails | Context for the team to triage without opening the app; the user's emails quote the conversation, give a concrete closing date and one-click answers; no brand header for now |

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

1. Any signed-in user can open a request from any authenticated screen, choosing a type and describing the problem, without leaving the screen. The subject is optional.
2. The request stores the context (URL, filters, date range, role and scope, browser, screen size) and a plain-words description of it, without the user typing it.
3. The screenshot shows the screen as it was when the form opened (never the form itself), and the user can review or remove it before sending.
4. "¿Este dato no cuadra?" on a metric or table opens the form as "Dato incorrecto", pre-filled with that figure.
5. A new request emails `alban.rodriguez95@gmail.com` with the number, type, subject, requester, screen, filters, dates, role and a link to reply.
6. The user reaches "Mis solicitudes" from Ayuda y soporte, sees each request's stage and what to expect, and can reply; the menu shows how many requests wait for their answer.
7. A user can never see another user's requests or any internal note.
8. An agent (real ADMIN or superadmin) reaches "Solicitudes" from the side menu, sees every request ordered by those waiting for the team, filters by status, type and priority, and changes status and priority.
9. An agent's public reply emails the requester, quoting what the requester last said; a user's reply emails the notification address.
10. When a request is resolved, the requester gets an email with the Novedades entry if one is linked, the closing date and "Sí, todo bien" / "Sigue pasando" links.
11. "Sí, cerrar" closes the request; "Sigue pasando" reopens it for the team (with an optional comment); without an answer it closes 7 days later.
12. An agent can open the user's screen with the same URL, filters and date range in one click, and view the app as the requester's role and scope with a permanent banner and an exit (agents only, tab only).
13. An agent sees the requester's other requests and recent requests from the same screen and filters.
14. All support endpoints reject requests without a session (401), agent actions from non-agents (403), and other users' requests (404).

## Decisions still to validate

- Whether the notification address should become "all ADMIN users" once more people handle support.
- Whether 7 days is the right auto-close window.
- Whether "En curso" should notify the user (currently it does not, to avoid noise).
- Whether the satisfaction answers should feed a small report (share of requests solved at the first answer).
- A brand header for the emails (left out for now).
- Retention: how long closed requests and their screenshots are kept (currently forever).
