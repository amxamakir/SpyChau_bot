# SpySkaut

Telegram Mini App and Cloudflare Worker for an opt-in archive of Telegram Business updates. The public product and bot are branded SpySkaut; the existing Worker URL and Cloudflare resource names retain their original identifiers so production data stays attached during the bot migration.

## Current status

- The existing interface is served as static assets by Cloudflare Workers.
- `src/worker.js` provides the API and Telegram webhook routes.
- `migrations/` contains versioned Cloudflare D1 schema changes.
- The original Python API remains available for local development, but Cloudflare runs the Worker implementation.
- Telegram authentication and webhook handling require secrets configured in Cloudflare.
- Incoming Telegram Business messages are retained in an encrypted, per-user journal for up to 7 days, capped at 5,000 newest records per user. Photos, voice notes, video messages, and other supported media up to Telegram's 20 MB bot-download limit are encrypted separately in private R2 storage.
- Replacing the bot token does not move or delete the D1 database or R2 journal. Users must connect the new `@SpySkaut_bot` through Telegram Business again; their prior archive and subscription rows remain associated with the same Telegram user ID.

## Local preview

Install Wrangler, then run:

```powershell
npm install --save-dev wrangler
npx wrangler dev
```

For authenticated Mini App API requests, create `.dev.vars` locally with `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and a random `JOURNAL_ENCRYPTION_KEY` of at least 32 characters. This file is ignored by Git. Do not commit tokens, encryption keys, or real message data.

## Cloudflare setup

Follow [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md) to create separate D1 databases and R2 buckets for development and production, configure Worker secrets, apply migrations, and connect GitHub Builds.

The GitHub repository is the canonical source and version history. Cloudflare Workers Builds publishes each push on the configured branch and keeps deployment versions. Use a commit title like `v0.2.2: Show Telegram profile photos`; Cloudflare shows that version and change in its deployment history, and Telegram opens the latest deployed app at the same URL. See [RELEASES.md](./RELEASES.md) for publishing and rollback. Database backups and retention are separate from code deployments.

## Telegram constraints

Read [TELEGRAM_POLICY.md](./TELEGRAM_POLICY.md) before processing real data. Access is limited to chats the account owner explicitly connects through Telegram Business and updates that Telegram delivers after connection. Secret Chats are not available through the official Bot API. Timed media is best-effort; the product must not promise universal recovery or preservation.

Digital services sold inside Telegram must be paid for in Telegram Stars (`XTR`).
