/**
 * Mock data mirroring examples/basic: servers/ma-commu.yaml (roles, portal theme) and the
 * `onboarding` instance of bots/moderator/bot.yaml.
 */
import type { PortalServer, User } from "@cicord/client";

const logo = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5865f2"/><stop offset="1" stop-color="#eb459e"/></linearGradient></defs>
    <rect width="96" height="96" rx="28" fill="url(#g)"/>
    <circle cx="38" cy="44" r="17" fill="none" stroke="#fff" stroke-width="7"/>
    <circle cx="58" cy="52" r="17" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="7"/>
  </svg>`,
)}`;

function mockMode(): "light" | "dark" | "system" {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "light" || mode === "system" ? mode : "dark";
}

const banner = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1b1d3a"/><stop offset=".55" stop-color="#2b2466"/><stop offset="1" stop-color="#5a1f4f"/>
      </linearGradient>
      <radialGradient id="a" cx=".22" cy=".35" r=".45"><stop offset="0" stop-color="#5865f2" stop-opacity=".85"/><stop offset="1" stop-color="#5865f2" stop-opacity="0"/></radialGradient>
      <radialGradient id="b" cx=".82" cy=".7" r=".5"><stop offset="0" stop-color="#eb459e" stop-opacity=".75"/><stop offset="1" stop-color="#eb459e" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1500" height="500" fill="url(#bg)"/><rect width="1500" height="500" fill="url(#a)"/><rect width="1500" height="500" fill="url(#b)"/>
    <g fill="none" stroke="#fff" stroke-linecap="round"><circle cx="1180" cy="170" r="110" stroke-opacity=".18" stroke-width="26"/><circle cx="1290" cy="230" r="110" stroke-opacity=".12" stroke-width="26"/></g>
  </svg>`,
)}`;

export const portalServer: PortalServer = {
  key: "ma-commu",
  name: "Ma Commu",
  iconUrl: "",
  // `?mode=light|system` previews the other palettes in mock mode.
  theme: { primary: "#5865f2", accent: "#eb459e", logo, mode: mockMode() },
  title: "Bienvenue sur Ma Commu",
  tagline: "La commu francophone des soirées jeux, tournois et lives.",
  description: [
    "Ici, on joue **ensemble** : Minecraft, Valorant, League of Legends et tout ce qui passe.",
    "",
    "## Ce que tu trouveras ici",
    "- des soirées jeux chaque vendredi",
    "- des tournois mensuels avec des lots",
    "- une équipe de modération à l'écoute",
    "",
    "Lis le [règlement](https://ma-commu.example/regles) avant de poster.",
  ].join("\n"),
  banner,
  links: [
    { label: "Site web", url: "https://ma-commu.example", icon: "website" },
    { label: "Chaîne YouTube", url: "https://www.youtube.com/@ma-commu", icon: "youtube" },
    { label: "Lives Twitch", url: "https://www.twitch.tv/ma-commu", icon: "twitch" },
    { label: "Règlement", url: "https://ma-commu.example/regles", icon: "rules" },
  ],
  pages: { onboarding: true, profile: true, leaderboard: true, tickets: true },
  locale: "fr",
  plugins: [
    {
      bot: "moderator",
      instance: "onboarding",
      plugin: "onboarding",
      routes: ["GET /steps", "POST /complete"],
    },
    {
      bot: "moderator",
      instance: "levels",
      plugin: "levels",
      routes: ["GET /leaderboard", "GET /me"],
    },
    { bot: "moderator", instance: "tickets", plugin: "tickets", routes: ["GET /tickets"] },
  ],
};

export const leaderboard = [
  ["1001", "Léa", 14, 18420],
  ["1002", "Nico", 12, 15210],
  ["1003", "Inès", 11, 13980],
  ["1004", "Hugo", 9, 9340],
  ["1005", "Camille", 8, 8120],
  ["1006", "Yanis", 6, 5230],
  ["1007", "Sarah", 5, 4410],
  ["1008", "Malo", 3, 1980],
].map(([userId, displayName, level, xp], i) => ({
  rank: i + 1,
  userId: userId as string,
  displayName: displayName as string,
  avatarUrl: null,
  level: level as number,
  xp: xp as number,
}));

export const tickets = [
  {
    id: "42",
    subject: "Problème d'accès au salon Valorant",
    status: "open" as const,
    author: { id: "1005", displayName: "Camille" },
    createdAt: "2026-11-20T18:12:00Z",
  },
  {
    id: "41",
    subject: "Signalement : spam en vocal",
    status: "open" as const,
    author: { id: "1007", displayName: "Sarah" },
    createdAt: "2026-11-19T21:40:00Z",
  },
  {
    id: "37",
    subject: "Idée de tournoi Minecraft",
    status: "closed" as const,
    author: { id: "1002", displayName: "Nico" },
    createdAt: "2026-11-12T09:05:00Z",
  },
];

export const user: User = { id: "1001", username: "lea.gg", displayName: "Léa", avatarUrl: "" };

export const roles: Record<string, { id: string; name: string; color: string }> = {
  admin: { id: "r1", name: "Admin", color: "#e74c3c" },
  modo: { id: "r2", name: "Modo", color: "#e67e22" },
  member: { id: "r3", name: "Membre", color: "#3498db" },
  minecraft: { id: "r4", name: "Minecraft", color: "#5b8731" },
  valorant: { id: "r5", name: "Valorant", color: "#ff4655" },
  lol: { id: "r6", name: "League of Legends", color: "#c89b3c" },
  pc: { id: "r7", name: "PC", color: "#95a5a6" },
  console: { id: "r8", name: "Console", color: "#9b59b6" },
  mobile: { id: "r9", name: "Mobile", color: "#1abc9c" },
  "ping-events": { id: "r10", name: "Notifs événements", color: "#f1c40f" },
};

interface StepConfig {
  id: string;
  title: string;
  description?: string;
  multiple?: boolean;
  required?: boolean;
  options: { role: string; label?: string; emoji?: string; description?: string }[];
}

export const onboardingConfig: {
  title: string;
  intro: string;
  steps: StepConfig[];
  completedRole?: string;
  successMessage: string;
} = {
  title: "Bienvenue sur Ma Commu !",
  intro:
    "Trois petites questions pour personnaliser ton expérience. Tu pourras changer d'avis quand tu veux avec /onboarding.",
  steps: [
    {
      id: "jeux",
      title: "À quoi tu joues ?",
      description: "Tu auras accès aux salons et aux pings de tes jeux.",
      multiple: true,
      options: [
        { role: "minecraft", emoji: "⛏️", description: "Survie, créatif et serveur de la commu" },
        { role: "valorant", emoji: "🎯", description: "Ranked, customs et tournois" },
        {
          role: "lol",
          label: "League of Legends",
          emoji: "🛡️",
          description: "Flex, ARAM et Clash",
        },
      ],
    },
    {
      id: "plateforme",
      title: "Tu joues surtout sur…",
      description: "Pour trouver des coéquipiers sur la même plateforme.",
      required: true,
      options: [
        { role: "pc", emoji: "🖥️" },
        { role: "console", emoji: "🎮" },
        { role: "mobile", emoji: "📱" },
      ],
    },
    {
      id: "notifs",
      title: "On te prévient pour les événements ?",
      description: "Soirées jeux, tournois et lives de la commu. Zéro spam, promis.",
      options: [
        {
          role: "ping-events",
          label: "Oui, ping-moi !",
          emoji: "🔔",
          description: "Tu seras mentionné à chaque nouvel événement",
        },
      ],
    },
  ],
  completedRole: "member",
  successMessage: "C'est tout bon ! Tes rôles sont à jour, file dire bonjour dans #général.",
};
