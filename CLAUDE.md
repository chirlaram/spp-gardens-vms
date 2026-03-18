# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**SPP Gardens Venue Management System** — A hotel/venue management app built with React + Vite (frontend) and Supabase (database + auth), deployed on Vercel.

## Commands

- Dev server: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`
- Lint: `npm run lint`

## Architecture

### Folder Structure

```
src/
  components/   # Reusable UI components (PascalCase filenames)
  pages/        # Route-level page components
  hooks/        # Custom React hooks (useXxx naming)
  utils/        # Pure helper functions
  services/     # All Supabase calls — no DB access outside this folder
```

### Data Layer

All Supabase interactions are isolated in `/services`. Pages and components never call Supabase directly — they go through service functions. Auth and API keys must use environment variables (`.env`), never hardcoded.

## Code Rules

- Functional components with hooks only — no class components
- `camelCase` for functions and variables, `PascalCase` for components
- Every async operation needs a loading state and error handling
- No duplicated logic — extract reusable components and hooks
- Add comments for any non-obvious or complex logic

## Design Rules

- **Primary:** Forest green `#1c3a1e`
- **Accent:** Gold `#c8a951`
- Mobile-first responsive design
- Professional, elegant, hotel-management aesthetic — clean and minimal UI
