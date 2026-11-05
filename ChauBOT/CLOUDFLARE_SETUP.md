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
callback_query
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

The application uses Tribute Creator subscriptions for «Безлимит» and «Группы», and Tribute Digital Products for notification packages. The Tribute Shop API is not used to start new checkouts.

1. Create recurring subscriptions in the Tribute Creator Dashboard for the unlimited periods (1, 6, and 12 months) and group plans (3, 10, and 20 groups, billed monthly). Make sure the price and billing period for each option match the values in `src/worker.js`. Copy each Telegram or web checkout link. Tribute's creator subscriptions can be configured with different billing periods, including monthly, half-yearly, and yearly. A linked bank card is needed for automatic renewal; without one, Tribute asks the subscriber to renew manually.

2. Set the production Worker variable `TRIBUTE_SUBSCRIPTIONS` to a JSON object with one entry per purchasable subscription. Use the keys `personal_unlimited:month`, `personal_unlimited:half-year`, `personal_unlimited:year`, `groups:groups3`, `groups:groups10`, and `groups:groups20`. Each entry must contain `amount_rub` and at least one valid `telegram_link` or `web_link`. Copy the subscription link from Tribute Creator Dashboard → Channels & Groups → select the channel and subscription → Links. Product links such as `https://web.tribute.tg/p/...` and Telegram links whose `startapp` starts with `p` are digital products and are rejected for subscriptions. The same Tribute subscription link may be used for several periods if it offers those exact periods and prices. The checkout is enabled only for a tariff with a configured subscription link and matching price.

   Example shape (replace the sample link with the actual link from Tribute):

   ```json
   {
     "personal_unlimited:month": {
       "telegram_link": "https://t.me/tribute/app?startapp=ep_REPLACE_ME",
       "amount_rub": 249
     }
   }
   ```

3. Keep the three `personal_package` entries in `TRIBUTE_PRODUCTS` for packs of 100, 300, and 500 notifications. The six older unlimited/group entries remain only to recognize delayed webhooks from old digital-product purchases; the app no longer sends buyers to them. In Tribute, set the package prices to 189 ₽, 499 ₽, and 699 ₽, enable card payment, and leave Telegram Stars disabled for now. Before redirecting a buyer, the Worker checks the product's current approval, price, and payment settings through the Tribute Products API.

4. In Tribute Creator Dashboard → Settings → API Keys, set the webhook URL to `https://spychau-bot.senba11.workers.dev/webhooks/tribute` and send a test request. The webhook uses the existing `TRIBUTE_API_KEY` Worker secret to verify the signature and process subscription lifecycle events and Digital Product purchases/refunds. Shop API events are still accepted only to finish handling any old orders that were created before the switch.

5. Apply migration `0014_tribute_recurring_subscriptions.sql` to the intended D1 database before deploying Worker code that uses it. The existing D1, R2 bucket, and encryption key must remain unchanged.

Tribute chooses which payment methods it shows to a buyer. The application labels this option as «Оплата через Tribute» and does not promise a particular method such as SBP or Telegram Stars. Automatic renewal requires a payment method that Tribute can charge again, currently a linked bank card. If SBP is offered but does not support recurring charging for that subscription, Tribute handles the next renewal manually.

Do not change the D1/R2 bindings or `JOURNAL_ENCRYPTION_KEY`: user IDs stay the same between bots, so existing archive rows, subscriptions, and encrypted journal objects remain available after the user opens the app through the new bot.

## Release and data handling

Follow [RELEASES.md](./RELEASES.md) for version numbers, descriptive GitHub commits, Cloudflare version labels, and rollback. Cloudflare Workers Builds publishes each push to `main` and records deployments tied to commits. The configured Deploy command uses the commit title as the Cloudflare version title and tag. Telegram keeps opening the app at the same Worker URL, so BotFather does not need changes for normal releases. Apply every new D1 migration to the target environment before deploying code that depends on it. Configure D1 backup/retention separately; a Worker deployment is not a backup of user data.
