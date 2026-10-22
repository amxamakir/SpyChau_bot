# SpyChau release process

## Version numbers

Use `vMAJOR.MINOR.PATCH` for every production release.

- Increase `PATCH` for fixes and small changes.
- Increase `MINOR` for a backward-compatible feature.
- Increase `MAJOR` for a change that requires a migration or user action.

Every production commit to `main` deploys automatically. Put one release in each commit and use this title format:

```text
v0.3.0: Add connection management
```

## What Cloudflare records

The production Deploy command reads the Git commit title and applies it as the Worker version message. It also sets the Worker version tag to the text before the colon, such as `v0.3.0`. This is configured in **Workers & Pages → spychau-bot → Settings → Builds**:

```sh
npx wrangler deploy --env production --name spychau-bot --message "$(git log -1 --pretty=%s)" --tag "$(git log -1 --pretty=%s | cut -d: -f1)"
```

Cloudflare then publishes every push on `main` and keeps its Worker versions in **Deployments**. For a permanent version tag in GitHub, create a GitHub Release with the same version and change title after the Cloudflare build succeeds.

## Roll back

In Cloudflare, open **Workers & Pages → spychau-bot → Deployments**, select the known-good Worker version, and choose **Rollback**. Wrangler can also roll back to a version ID with `npx wrangler rollback <VERSION_ID>`. A rollback creates a new active deployment using the selected old Worker version.

A Worker rollback restores Worker code and configuration. It does not undo D1 data writes or schema migrations. Never edit a migration already applied in production. Repair production schema or data with a new forward migration, and back up important production data separately.

For each release, apply any required D1 migration before deploying code that depends on it, then confirm the Cloudflare build and deployment succeeded.
