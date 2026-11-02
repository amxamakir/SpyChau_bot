# GitHub and Cloudflare setup

This guide uses a private GitHub repository named `SpyChau_bot` and Cloudflare Workers Builds.

## 1. Create the Cloudflare databases

Install Wrangler and sign in from the project folder:

```powershell
npm install --save-dev wrangler
npx wrangler login
```

For a local preview, apply the migration to Wrangler's local D1 database first:

```powershell
npx wrangler d1 migrations apply spychau-bot-dev --local
npx wrangler dev
```

Create isolated development and production databases:

```powershell
npx wrangler d1 create spychau-bot-dev
npx wrangler d1 create spychau-bot-production
```

Copy the returned database IDs into the matching `database_id` fields in `wrangler.jsonc`. IDs identify the databases and are not credentials. Do not create a shared database for both environments.

Apply the initial schema to each database:

```powershell
npx wrangler d1 migrations apply spychau-bot-dev --remote
npx wrangler d1 migrations apply spychau-bot-production --remote --env production
```

## 2. Create private journal storage

Create two private R2 buckets in Cloudflare, one for each environment:

- `spychau-journal-dev`
- `spychau-journal-production`

The Worker binds these buckets as `JOURNAL`. Do not enable public access or attach a public custom domain; archived media is served only through short-lived, signed Worker URLs.

Apply the journal schema before deploying a Worker version that uses it:

```powershell
npx wrangler d1 migrations apply spychau-bot-dev --remote
npx wrangler d1 migrations apply spychau-bot-production --remote --env production
```

## 3. Configure Worker secrets

Set the development secrets:

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

Then set the same secret names for the production environment with production values:

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN --env production
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production
```

Add `JOURNAL_ENCRYPTION_KEY` as a Worker secret in development and production. Use one random value of at least 32 characters per environment; never reuse a value across unrelated projects or store it in Git. Losing this key makes encrypted journal contents unreadable.

```powershell
npx wrangler secret put JOURNAL_ENCRYPTION_KEY
npx wrangler secret put JOURNAL_ENCRYPTION_KEY --env production
```

Wrangler prompts for each value so tokens do not need to be written into command history or source files. Never add these values to GitHub files or screenshots.

## 4. Create and connect GitHub

Create a **private** GitHub repository named `SpyChau_bot`. Push the local `main` branch and its commits to it. In Cloudflare, open **Workers & Pages → Create application → Connect to Git**, authorize the Cloudflare Workers and Pages GitHub app for this repository, and create the Worker from `wrangler.jsonc`.

Configure the production branch as `main`. Connect a separate preview branch after it is created for development previews. Check the first deployment in the Cloudflare dashboard; it must use the correct environment and D1 binding.

The configured D1 IDs must be present before the first Cloudflare build. Add the Worker secrets in the dashboard for each environment too if the Cloudflare Git connection deploys before Wrangler has been used to upload secrets.

## 5. Connect Telegram

After the Worker has an HTTPS URL, configure the Mini App domain through BotFather. Set the Telegram webhook URL to:

```text
https://<your-worker-domain>/webhooks/telegram
```

Set the same webhook secret in Telegram's `secret_token` field and in the Cloudflare Worker secret. Subscribe to these update types:

```text
business_connection
business_message
edited_business_message
deleted_business_messages
message
edited_message
my_chat_member
```

Test with a Telegram Business connection that you control before inviting users. Confirm the consent screen, archive behavior, revocation behavior, deletion, and privacy text before enabling real use.

## Move production to `@SpySkaut_bot`

Keep the existing Worker `spychau-bot`, its URL, production D1 database, private R2 bucket, and `JOURNAL_ENCRYPTION_KEY`. They contain the live application and encrypted archive. Do not create replacement databases or change the encryption key as part of a bot migration.

1. In BotFather, select `@SpySkaut_bot`, enable Business Mode (Secretary Mode), configure its Main Mini App to open the current Worker URL, and set its menu button to the same URL.
2. Replace only the production `TELEGRAM_BOT_TOKEN` Worker secret with the new bot's token. Use Cloudflare's secret editor or Wrangler's prompt; do not place the token in source code, a command argument, or Git.
3. Set a `TELEGRAM_WEBHOOK_SECRET` for production and register the new bot webhook at `https://spychau-bot.senba11.workers.dev/webhooks/telegram` with that exact `secret_token` and the update types listed above. Keep pending updates during the cutover.
4. Open `@SpySkaut_bot`, send `/start`, launch the Mini App, and verify that Telegram authentication, the user's existing profile/archive/subscription, bot replies, and a test Business event work.
5. Reconnect each Telegram Business account to `@SpySkaut_bot` and grant the same chats and rights. Connections belong to the bot, so Telegram does not transfer them automatically. A short gap before reconnection cannot be backfilled from Telegram history.
6. After the new bot is confirmed, disconnect the old bot from Business settings and remove or revoke its webhook/token so it cannot keep sending updates to production.

## Prepare Tribute payments

1. Apply the payment migration to the intended database before deploying the Worker:

   ```powershell
   npx wrangler d1 migrations apply spychau-bot-dev --remote
   npx wrangler d1 migrations apply spychau-bot-production --remote --env production
   ```

2. After deploying the Tribute webhook route, set the API key as a Worker secret. Run Wrangler from the project folder; it will prompt for the value so it does not enter shell history:

   ```powershell
   npx wrangler secret put TRIBUTE_API_KEY --env production
   ```

3. In Tribute Creator Dashboard → Settings → API Keys, set the webhook URL to `https://spychau-bot.senba11.workers.dev/webhooks/tribute`, save it, and use **Send test request** to check delivery.

4. Keep `TRIBUTE_PAYMENTS_ENABLED` set to `false` until the signed webhook has been verified, payment terms and support contact are configured, and the checkout behavior has been confirmed. Then enable the flag for production.

Do not change the D1/R2 bindings or `JOURNAL_ENCRYPTION_KEY`: user IDs stay the same between bots, so existing archive rows, subscriptions, and encrypted journal objects remain available after the user opens the app through the new bot.

## Release and data handling

Follow [RELEASES.md](./RELEASES.md) for version numbers, descriptive GitHub commits, Cloudflare version labels, and rollback. Cloudflare Workers Builds publishes each push to `main` and records deployments tied to commits. The configured Deploy command uses the commit title as the Cloudflare version title and tag. Telegram keeps opening the app at the same Worker URL, so BotFather does not need changes for normal releases. Apply every new D1 migration to the target environment before deploying code that depends on it. Configure D1 backup/retention separately; a Worker deployment is not a backup of user data.
