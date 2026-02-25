# DynaInfo 2.0 - Project Configuration

@~/.claude/settings/claude.md

## Tech Stack

**Backend:**
- Fastify 5 + TypeScript 5.7
- PostgreSQL (auth) + ClickHouse (analytics)
- Better Auth + Resend
- Drizzle ORM

**Frontend:**
- React 19 + Vite 7
- HeroUI + Tailwind CSS 4
- TanStack Query + Zustand
- React Router 7

## Project Commands

```bash
make setup-prod    # Interactive production setup
make deploy        # Full automated deployment
make dev           # Local development
make test          # Run tests
```

## Important Paths

- Backend: `/api`
- Frontend: `/web`
- SSL Certs: `/api/ssl` (in .gitignore)
- Deployment: `DEPLOYMENT.md`
