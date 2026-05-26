# Marketing Awards Voting App for Vercel

Vercel-ready anonymous voting app for the five marketing team awards.

## What It Does

- Shows only award categories that have nominations.
- Lets each team member submit one anonymous ballot from their browser.
- Stores only receipt IDs, timestamps, and anonymous selections.
- Shows live transparent results.
- Sends an email notification after each vote when email is configured.
- Includes an admin nomination editor for all five award categories.

## Local Run

```bash
npm run dev
```

If `npm` is not available:

```bash
node local-server.js
```

Open:

- Ballot: `http://localhost:3001`
- Results: `http://localhost:3001/results`
- Nominations: `http://localhost:3001/admin`

## Add Nominations

Use the nominations page and enter one nominee per line:

```text
Alex Chen | Led a campaign that influenced pipeline
Priya Shah | Created the AI workflow used by the team
```

Categories with no nominees are automatically hidden from the ballot.

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the project in Vercel.
3. Add persistent storage:
   - Create or connect a Vercel KV / Redis store.
   - Add the generated environment variables:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
4. Add admin protection:
   - `ADMIN_TOKEN=your-secret-token`
   - Open `/admin?token=your-secret-token` to edit nominations.
5. Add email delivery:
   - `RESEND_API_KEY=re_...`
   - `EMAIL_TO=awards-admin@example.com`
   - `EMAIL_FROM="Marketing Awards <awards@yourdomain.com>"`
6. Deploy.

## Email Options

Recommended production path is Resend:

```bash
RESEND_API_KEY=re_...
EMAIL_TO=awards-admin@example.com
EMAIL_FROM="Marketing Awards <awards@yourdomain.com>"
```

You can also use a generic webhook:

```bash
EMAIL_WEBHOOK_URL=https://hooks.example.com/marketing-awards
```

If email is not configured, notification payloads are saved to the outbox storage. In production this requires KV.

## Storage Notes

Vercel serverless deployments should not rely on local JSON files for production data. This app uses Vercel KV / Redis REST variables when present.

For local development, JSON files under `data/` are used automatically. On Vercel, configure KV before collecting real nominations or votes.
