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

## 2. Configure Worker secrets

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

Wrangler prompts for each value so tokens do not need to be written into command history or source files. Never add these values to GitHub files or screenshots.

## 3. Create and connect GitHub

Create a **private** GitHub repository named `SpyChau_bot`. Push the local `main` branch and its commits to it. In Cloudflare, open **Workers & Pages → Create application → Connect to Git**, authorize the Cloudflare Workers and Pages GitHub app for this repository, and create the Worker from `wrangler.jsonc`.

Configure the production branch as `main`. Connect a separate preview branch after it is created for development previews. Check the first deployment in the Cloudflare dashboard; it must use the correct environment and D1 binding.

The configured D1 IDs must be present before the first Cloudflare build. Add the Worker secrets in the dashboard for each environment too if the Cloudflare Git connection deploys before Wrangler has been used to upload secrets.

## 4. Connect Telegram

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
```

Test with a Telegram Business connection that you control before inviting users. Confirm the consent screen, archive behavior, revocation behavior, deletion, and privacy text before enabling real use.

## Release and data handling

Follow [RELEASES.md](./RELEASES.md) for version numbers, descriptive GitHub commits, Cloudflare version labels, and rollback. Cloudflare Workers Builds publishes each push to `main` and records deployments tied to commits. The configured Deploy command uses the commit title as the Cloudflare version title and tag. Telegram keeps opening the app at the same Worker URL, so BotFather does not need changes for normal releases. Apply every new D1 migration to the target environment before deploying code that depends on it. Configure D1 backup/retention separately; a Worker deployment is not a backup of user data.
