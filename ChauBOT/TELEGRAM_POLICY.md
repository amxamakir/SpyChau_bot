# Telegram policy and platform constraints

Research date: 2026-10-22

This note records official Telegram rules and API constraints relevant to SpySkaut. It is a product and engineering reference, not legal advice.

## Supported access model

- A normal Telegram bot cannot read all of a user's private chats. A user must explicitly connect the bot through Telegram Business and assign the chats the bot may manage.
- In chats granted to it, a connected Business bot can receive messages, edits, and deletion updates through `business_message`, `edited_business_message`, and `deleted_business_messages`.
- Access and permissions can be changed or revoked by the account owner in Telegram Business settings. The app must reflect disconnects and permission changes promptly.
- Secret Chats are end-to-end encrypted and are not supported by the official Bot API. We must not claim they can be monitored.
- A group-chat mode is separate: the bot only sees group messages when added with appropriate access/admin configuration. This should be an explicit product feature, not implied by Business access.

## Product promises and ephemeral media

- Describe monitoring as limited to connected chats and updates Telegram delivers after connection.
- Do not promise recovery of messages sent before connection, deleted content without a received update, or any media that Telegram does not deliver to the bot.
- Treat timed/ephemeral media as best-effort only. Telegram's API documentation describes TTL media and view-triggered destruction, so the product must not claim universal preservation of one-view photos, videos, or voice messages.
- Replied media without an explicit one-time marker is held encrypted as a hidden candidate for at most five minutes. Promote it only if the source is marked ephemeral or Telegram reports the replied-to message as deleted; otherwise remove the pending journal record and its media object.
- Provide clear controls for chat selection, retention duration, export, deletion, and disconnecting access.

## Mini App security

- Validate Telegram Mini App `initData` on the backend before trusting the user identity or authorizing API requests.
- Never trust `initDataUnsafe` or client-supplied user IDs as authentication.
- Apply replay/freshness checks to `auth_date`, protect bot tokens and secrets, and use HTTPS for webhooks and app traffic.

## Data storage and privacy

- Store only data essential to the service and clearly explain its purpose to users before collection.
- Keep the latest 5,000 event records per user for no more than 7 days from receipt. A scheduled cleanup runs every 30 minutes; an event can remain until the next cleanup after its 7-day deadline.
- Store message contents in separate per-user journal objects in a private Cloudflare R2 bucket. Each event and media object is encrypted with AES-256-GCM using a key derived for that user from the separately configured `JOURNAL_ENCRYPTION_KEY`. D1 stores the event index and references needed to find the encrypted record; it does not store the message body after the journal write succeeds.
- Supported media (including photos, voice messages, video messages, and documents) is downloaded when Telegram delivers it and is under the Bot API's 20 MB file-download limit. Media that Telegram does not deliver, or files above the limit, cannot be retained.
- Deleting an account removes its journal objects and indexed events. Expired or excess records and their media are removed by scheduled cleanup.
- Delete data on user request, when no longer needed for the service, when the service ends (unless continued retention was explicitly agreed), or in response to lawful requests as applicable.
- Provide a clear privacy policy, terms, support contact, and accessible data deletion/disconnect controls.

## Payments

- Digital goods and services sold inside Telegram apps must be priced and paid for in Telegram Stars (`XTR`).
- Activate paid access only after receiving and verifying a successful payment update; a pre-checkout approval alone is not proof of payment.
- If using recurring bot subscriptions, Telegram documents monthly renewal in Stars. Make renewal, cancellation, support, and refunds clear to users.
- Provide `/terms`, `/support`, and `/paysupport` or equivalent easy-to-find flows and handle payment disputes promptly.

## Official sources

- [Telegram Privacy Policy: Bots and Telegram Business Chatbots](https://telegram.org/privacy)
- [Telegram Bot Platform Developer Terms of Service](https://telegram.org/tos/bot-developers)
- [Telegram Bot Terms of Service](https://telegram.org/tos/bots)
- [Connected Business Bots](https://core.telegram.org/api/bots/connected-business-bots)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Digital goods and services payments](https://core.telegram.org/bots/payments-stars)
- [Telegram Stars subscriptions](https://core.telegram.org/api/subscriptions)
- [Telegram API Terms of Service](https://core.telegram.org/api/terms)
