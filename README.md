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
| [`cicord.yaml`](cicord.yaml) | The project: tracked branch, runtime URL, write-back policies. |
| [`servers/cicord.yaml`](servers/cicord.yaml) | The server: profile, Community settings, roles, categories, channels and their permissions, AutoMod, native onboarding, welcome screen. |
| [`bots/cicord/bot.yaml`](bots/cicord/bot.yaml) | The bot: its intents and its plugin instances (grants and settings). |
| [`cicord.lock`](cicord.lock) | The official plugins it runs (welcome, audit-log, reaction-roles, tickets), from the signed [cicord-plugins](https://github.com/cicord/cicord-plugins) registry, pinned to an exact commit and integrity. |

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

## Learn more

- [Cicord documentation](https://cicord.dev/docs/)
- [Server reference](https://cicord.dev/docs/configuration/server/) and
  [bot reference](https://cicord.dev/docs/configuration/bot/)
- [Official plugins](https://cicord.dev/docs/plugins/official/)
- [How reconciliation works](https://cicord.dev/docs/concepts/reconciliation/)
- [Cicord on GitHub](https://github.com/cicord/cicord)
