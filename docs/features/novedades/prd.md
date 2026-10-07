> Living document · 2026-10-07 · DynaInfo 2.0

# Novedades

## Summary

A public "what's new" page for DynaInfo, plus an email list that sends subscribers a short digest the morning after each change.

## Problem

Improvements to DynaInfo ship regularly, but users only find out by chance. Nobody has one place to see what changed, and nobody is told when something they care about gets better.

## Goal

Every user-facing change is announced in one place and reaches the people who asked to hear about it, with no manual effort beyond writing the entry.

## User

- DynaInfo users (managers, distribution, sellers) who want to know what changed.
- Anyone else interested in the product who leaves their email.
- The team, who writes the entries as part of shipping a change.

## What it lets you do

- Read every published change, newest first, without signing in.
- Subscribe with an email and get a digest the morning after a change goes live.
- Unsubscribe in one click from any digest email.

## Model (in simple terms)

- **Entry:** a dated note describing one release, grouped into new, improved and fixed. Entries are written with the code change and reviewed with it.
- **Subscriber:** an email address that is either active or unsubscribed.
- **Digest:** one email per subscriber with the previous day's entries. No entries that day means no email.

## Guiding principles

- Entries are part of the change, like tests: a user-facing change is not done without one.
- Plain Spanish, concrete, not salesy.
- Leaving the list is always one click and never needs a login.

## Out of scope

- Personalised digests by role or topic.
- In-app notifications or a "new" badge in the sidebar.
- Double opt-in (confirmation email). Revisit if the list grows to cold audiences.

## Success metrics

- Every user-facing release on `master` has a published entry.
- Active subscribers over time, and unsubscribe rate per digest.

## Acceptance criteria

- `/novedades` is reachable without a session and lists published entries newest first.
- Subscribing an email shows a confirmation; subscribing it again changes nothing.
- The morning after an entry is published, each active subscriber receives one email with their own unsubscribe link.
- Clicking unsubscribe stops future emails and shows a confirmation page.
- A day is never emailed twice, even if the API restarts.
