# Sirsee MVP

Sirsee is a clickable mobile-first MVP for spontaneous small local gift giving, starting with a Chicagoland pilot focused on artisanal shops with delivery-capable gift ideas.

## Run locally

Sirsee needs the Python server so the app can geocode ZIP codes and fetch nearby real Chicagoland merchants.

```bash
python3 server.py
```

Then open [http://127.0.0.1:4174](http://127.0.0.1:4174).

### Google sign-in

Google OAuth is not enabled until you add credentials. The app code is ready; Supabase must have the Google provider turned on.

1. **Google Cloud Console** → [Credentials](https://console.cloud.google.com/apis/credentials) → Create **OAuth client ID** (Web application):
   - Authorized JavaScript origins: `http://127.0.0.1:4174`
   - Authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
2. Copy `.env.example` fields into `.env`:
   - `SUPABASE_ACCESS_TOKEN` from [Supabase account tokens](https://supabase.com/dashboard/account/tokens)
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Google Cloud
3. Run:

```bash
python3 scripts/configure_google_auth.py
```

Or enable Google manually in [Supabase Auth providers](https://supabase.com/dashboard/project/vidlwghrbtzfqeawgcjx/auth/providers?provider=Google) and add `http://127.0.0.1:4174` to redirect URLs.

The server serves the static UI and exposes:

- `POST /api/recommendations` — returns ranked local gift ideas for a brief
- `GET /api/reminders` — returns saved reminder signups for the signed-in user (Supabase RLS)
- `POST /api/reminders` — creates or updates a recurring reminder signup
- `DELETE /api/reminders` — removes a reminder signup

## Chicagoland ZIP examples

- `60025` — Glenview
- `60614` — Lincoln Park, Chicago
- `60201` — Evanston

ZIPs outside the Chicagoland metro area are rejected with a clear error.

## Real data model

Sirsee now uses real merchant data at the shop level:

- **Geocoding** via OpenStreetMap Nominatim
- **Curated merchants** in [data/merchants.json](data/merchants.json) with verified links, delivery notes, and coordinates
- **Live discovery** via OpenStreetMap Overpass for nearby florists, bakeries, coffee shops, and gift stores

Gift titles, category images, and prices are still estimated/template values for the MVP when a shop photo is unavailable. Merchant names, neighborhoods, distances, and outbound links are real. Many curated shops now cache representative photos under `assets/merchants/`.

To prefetch or refresh shop images locally:

```bash
python3 scripts/prefetch_merchant_images.py
```

To verify curated merchant links support online ordering:

```bash
python3 scripts/verify_merchant_links.py
```

Only merchants with working online-order links are returned in recommendations.

On the results screen, use **Show other ideas** to fetch another set of nearby merchants without changing the brief.

## MVP boundaries

- Merchant-level recommendations only — no live product inventory or exact pricing
- All proposed gift ideas should include a merchant delivery, shipping, or pickup path
- No real accounts, payments, or delivery coordination
- Reminder signups are stored in Supabase Postgres (`public.reminders`) with row-level security; scheduled email delivery is not wired up yet
- External geocoding/map services are free and rate-limited

## Project structure

- [app.js](app.js) — UI and brief flow
- [server.py](server.py) — static file server + recommendations API
- [data/merchants.json](data/merchants.json) — curated Chicagoland merchant pool
