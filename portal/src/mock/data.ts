/**
 * Mock data mirroring this repository: servers/cicord.yaml (portal texts and theme, roles)
 * and the plugin instances of bots/cicord/bot.yaml, with the routes of tickets 0.2. The
 * people are fictional.
 */
import type { AccessRole, PortalServer, User } from "@cicord/client";
import type { Person } from "../tickets/api.ts";

export type MockAnalytics = "members" | "public" | "off";

export function portalServer(mode: "light" | "dark" | "system"): PortalServer {
  return {
    key: "cicord",
    name: "Cicord",
    iconUrl: "",
    // The Cicord mark (assets/logo.svg, also the favicon).
    theme: { primary: "#5865f2", accent: "#3dd68c", logo: "/favicon.svg", mode },
    title: "The Cicord community",
    tagline:
      "GitOps for Discord: declare your server in git, review every change, and let Cicord apply it.",
    description: [
      "This is the community of **Cicord**, the open-source tool that manages Discord servers",
      "from a git repository: roles, channels, permissions, AutoMod, onboarding and bot plugins",
      "are declared in YAML, reviewed in pull requests, and kept in sync by a Cicord runtime.",
      "",
      "Join us on Discord to:",
      "",
      "- ask questions in `#help` and get help with self-hosting,",
      "- share what you built in `#showcase`,",
      "- write and publish plugins, or contribute to Cicord itself in `#development`.",
    ].join("\n"),
    banner: "",
    links: [
      { label: "Documentation", url: "https://cicord.dev/docs/", icon: "website" },
      { label: "GitHub", url: "https://github.com/cicord/cicord", icon: "github" },
      { label: "Join the Discord", url: "https://discord.gg/qTt5S2Fe4m", icon: "discord" },
    ],
    pages: { onboarding: true, profile: true, leaderboard: true, tickets: true },
    locale: "en",
    plugins: [
      {
        bot: "cicord",
        instance: "moderation",
        plugin: "moderation",
        routes: ["DELETE /warnings/:userId", "GET /warnings/:userId"],
      },
      { bot: "cicord", instance: "polls", plugin: "polls", routes: ["GET /polls/:id"] },
      {
        bot: "cicord",
        instance: "tickets",
        plugin: "tickets",
        routes: [
          "GET /staff",
          "GET /tickets",
          "GET /tickets/:id",
          "GET /tickets/mine",
          "GET /tickets/mine/:id",
          "PATCH /tickets/:id",
          "POST /tickets",
          "POST /tickets/:id/assign",
          "POST /tickets/:id/close",
          "POST /tickets/:id/messages",
          "POST /tickets/:id/reopen",
        ],
      },
    ],
  };
}

export const roles: Record<string, { id: string; name: string; color: string }> = {
  maintainer: { id: "r1", name: "Maintainer", color: "#5865f2" },
  moderator: { id: "r2", name: "Moderator", color: "#eb459e" },
  contributor: { id: "r3", name: "Contributor", color: "#f0b232" },
  "plugin-author": { id: "r4", name: "Plugin author", color: "#23a55a" },
  "changelog-ping": { id: "r5", name: "Changelog ping", color: "#000000" },
  member: { id: "r6", name: "Member", color: "#000000" },
};

/** The mock viewer for each access role (`?role=` in `pnpm dev`). */
export const viewers: Record<AccessRole, { user: User; roles: string[] }> = {
  member: {
    user: { id: "2001", username: "alex.dev", displayName: "Alex", avatarUrl: "" },
    roles: ["member", "plugin-author", "changelog-ping"],
  },
  moderator: {
    user: { id: "1002", username: "sam", displayName: "Sam", avatarUrl: "" },
    roles: ["member", "moderator"],
  },
  admin: {
    user: { id: "1001", username: "morgan", displayName: "Morgan", avatarUrl: "" },
    roles: ["member", "maintainer", "contributor"],
  },
};

/** Who can be assigned (`GET /staff`). */
export const staff: Person[] = [
  { id: "1001", displayName: "Morgan" },
  { id: "1002", displayName: "Sam" },
  { id: "1003", displayName: "Priya" },
];

/** Other members who opened tickets. */
export const members: Person[] = [
  { id: "2002", displayName: "Robin" },
  { id: "2003", displayName: "Kai" },
  { id: "2004", displayName: "Noor" },
  { id: "2005", displayName: "Elif" },
  { id: "2006", displayName: "Tomás" },
];

export const bot = { id: "9000", displayName: "Cicord", bot: true };
