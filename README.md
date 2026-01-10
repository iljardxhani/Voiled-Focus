# Voiled Focus

Day programming dashboard with planner, calendar, goals, and a prop login gate ready to swap to real auth. Built as a single-page shell with iframe-driven subpages and a dark, focus-friendly UI.

## Run locally
Open `index.html` in your browser (no build needed). For the prop login flow, the app starts at `login.html` and unlocks the shell once you submit the form.

## Next steps
- Deploy the static site (Netlify/Vercel) so HTTPS is ready for Google OAuth.
- Add a tiny backend for real auth (`/auth/google`, `/auth/callback`, `/me`, `/logout`), then point the Google button at it.

### Google OAuth env vars (Vercel)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET` (random string to sign session cookie)
- Optional: `BASE_URL` (override callback base; otherwise derived from request)
