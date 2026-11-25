# cicord-community

The configuration of the official [Cicord](https://github.com/cicord/cicord) community Discord
server, [discord.gg/qTt5S2Fe4m](https://discord.gg/qTt5S2Fe4m), managed with Cicord itself.

Cicord is GitOps for Discord: roles, channels, permissions, AutoMod, onboarding and the bot's
plugins are declared in YAML, reviewed in pull requests, and a Cicord runtime keeps the server
in line with this repository. This repository is that configuration, and a real-world example
of it.

## Layout

| Path | What it declares |
|---|---|
| [`cicord.yaml`](cicord.yaml) | The project: tracked branch, runtime URL, write-back policies, the community portal's build. |
| [`servers/cicord.yaml`](servers/cicord.yaml) | The server: profile, Community settings, roles, categories, channels and their permissions, AutoMod, native onboarding, welcome screen. |
| [`bots/cicord/bot.yaml`](bots/cicord/bot.yaml) | The bot: its intents and its plugin instances (grants and settings). |
| [`portal/`](portal) | The community portal served at [community.cicord.dev](https://community.cicord.dev): community activity and support tickets, a fork of the reference portal ([below](#the-community-portal)). |
| [`compose.yaml`](compose.yaml) | A local runtime on the Discord simulator, for end-to-end testing. |
| [`cicord.lock`](cicord.lock) | The official plugins it runs (welcome, audit-log, reaction-roles, tickets, moderation, polls, github-releases), from the signed [cicord-plugins](https://github.com/cicord/cicord-plugins) registry, pinned to an exact commit and integrity. |

Keys in the YAML (`maintainer`, `general`, `mod-log`…) are stable identifiers; display names
(`name:`) can change freely. Rename a key with `cicord mv`, never by hand, so the Discord
resource is kept instead of being recreated.

## Proposing a change

Anyone can propose a change with a pull request:

1. Fork the repository and edit the YAML.
2. Check it offline:

   ```sh
   cicord validate .
   ```

   [Install the CLI](https://cicord.dev/docs/getting-started/installation/) first.
3. Open a pull request and explain why. Changes under `servers/**` (roles, channels,
   permissions, moderation) are always reviewed by a maintainer. Please don't propose roles
   that grant permissions to everyone who picks them.

Maintainers can also edit plugin settings from the admin console: those edits are committed
here directly (`bots/**`, `plugins/**`), while structural changes made there open a pull
request (see `writeBack` in [`cicord.yaml`](cicord.yaml)).

## How changes reach Discord

The runtime at `community.cicord.dev` tracks the `main` branch. On every new commit it:

1. **validates** the repository (the same checks as `cicord validate`) and builds the plugins;
   a revision that fails is rejected and the previous one keeps running;
2. **plans and applies** the server: it creates, updates and reorders what differs, and only
   ever touches the resources declared here;
3. **activates** the bot's plugins with their new settings, without reconnecting.

The server's `syncPolicy`:

- `selfHeal: true`: a manual change in Discord to something declared here is reverted. Change
  the YAML instead.
- `prune: false`, `deletionProtection: true`: removing something from the YAML stops managing
  it but never deletes it from Discord.

Maintainers can preview a pull request against the live server with
`cicord plan --remote` (`CICORD_RUNTIME_URL` and `CICORD_RUNTIME_TOKEN` set).

## The community portal

[community.cicord.dev](https://community.cicord.dev) serves [`portal/`](portal), a fork of
the reference portal (`cicord portal init`) built on the Cicord portal SDK (`@cicord/client`,
`@cicord/react`, `@cicord/ui`, from npm at the version of `cicord`: `cicord portal upgrade`
bumps them). Its
theme, texts and links stay in `servers/cicord.yaml` (`spec.portal`); `cicord.yaml`
`spec.portal.path` points the runtime at the committed build, `portal/dist/`.

| Page | Who | What |
|---|---|---|
| Activity (`/activity`) | members, or anyone (`spec.analytics.portal`) | Server-wide activity over 7, 30 or 90 days: key figures against the previous period, messages and active members per day, busiest public channels, most used bot commands, and the busiest hours in the viewer's time zone. |
| My tickets (`/tickets`) | members | Their tickets with the `tickets` plugin, and opening one from the portal. |
| Support queue (`/support`) | moderators and admins | Every ticket, filtered and sorted, with the conversation, replies, assignment, priority, label, close and reopen. |
| Profile (`/me`) | members | Their roles on the server. |

Roles come from `GET /api/v1/portal/cicord/me` (`useMember()`): `spec.access` in
`servers/cicord.yaml` makes maintainers admins and moderators moderators; the runtime and
the plugin enforce the same rules on every route. The Activity page shows what
`spec.analytics.portal` in `servers/cicord.yaml` shares (`members` here). The ticket pages
call the routes of the `tickets` plugin with `useRouteQuery` and `useRouteMutation`
(`@cicord/react`), typed from its route contract in `portal/src/cicord-routes.d.ts`
(generated by `cicord portal typegen`, regenerated by `cicord portal build`).

### Working on the portal

Node 26 and pnpm 12. Every change to `portal/src` is committed with its build: CI
(`.github/workflows/cicord-portal.yml`) rebuilds the portal and fails when `portal/dist`
differs, and `portal-quality.yml` runs the format, lint, type and dead-code checks.

```sh
cd portal && pnpm install
pnpm dev                 # http://localhost:5174, against an in-browser fake runtime:
                         #   ?role=member|moderator|admin  ?analytics=members|public|off  ?mode=light|dark
pnpm test                # Vitest and Testing Library
pnpm check               # vp fmt --check, type-aware oxlint, tsc
pnpm knip                # unused files, exports and dependencies
cicord portal build      # from the repository root: install, route types, build into portal/dist
cicord portal build --check   # what CI checks
```

End to end, against a real runtime on the Discord simulator and this repository
([`compose.yaml`](compose.yaml)):

```sh
docker compose up                         # runtime on http://127.0.0.1:7420, serves portal/dist at /
cd portal && pnpm dev:runtime             # hot-reloading portal on http://localhost:5174
```

Sign in as one of the simulated users listed on the home page. The simulator has no
activity history: the Activity page shows what it records from then on, and `pnpm dev`
shows it with sample data. `CICORD_IMAGE` picks another image (for example one built from a
checkout of [cicord/cicord](https://github.com/cicord/cicord)); `cicord dev --sim` with a
local `cicord` binary does the same without Docker.

## Learn more

- [Cicord documentation](https://cicord.dev/docs/)
- [Server reference](https://cicord.dev/docs/configuration/server/) and
  [bot reference](https://cicord.dev/docs/configuration/bot/)
- [Official plugins](https://cicord.dev/docs/plugins/official/)
- [Custom portal](https://cicord.dev/docs/portal/custom-portal/)
- [How reconciliation works](https://cicord.dev/docs/concepts/reconciliation/)
- [Cicord on GitHub](https://github.com/cicord/cicord)
