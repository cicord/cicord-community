import { createCicordClient } from "@cicord/client";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { App } from "../src/App.tsx";
import type { PortalConfig } from "../src/config.ts";
import { createMockRuntime } from "../src/mock/runtime.ts";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

function mockConfig(): PortalConfig {
  const runtime = createMockRuntime();
  return {
    client: createCicordClient({ fetch: runtime.fetch }),
    login: () => window.history.replaceState(null, "", runtime.signedLink("/onboarding")),
    mock: true,
  };
}

test("home shows the no-code customization and a login button when logged out", async () => {
  render(<App config={mockConfig()} />);
  expect(
    await screen.findByRole("heading", { level: 1, name: "Bienvenue sur Ma Commu" }),
  ).toBeTruthy();
  expect(
    screen.getByText("La commu francophone des soirées jeux, tournois et lives."),
  ).toBeTruthy();
  // description (Markdown)
  expect(screen.getByRole("heading", { name: "Ce que tu trouveras ici" })).toBeTruthy();
  expect(screen.getByText("ensemble").tagName).toBe("STRONG");
  // links
  const links = within(screen.getByRole("list", { name: "Liens" })).getAllByRole("link");
  expect(links.map((a) => a.textContent)).toEqual([
    "Site web",
    "Chaîne YouTube",
    "Lives Twitch",
    "Règlement",
  ]);
  expect(links[0]?.getAttribute("rel")).toBe("noopener noreferrer");
  expect(await screen.findByRole("button", { name: "Se connecter avec Discord" })).toBeTruthy();
});

test("a signed bot link logs in and the onboarding flow assigns roles", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/onboarding?cicord_token=signed");
  render(<App config={mockConfig()} />);

  expect(
    await screen.findByRole("heading", { name: "À quoi tu joues ?" }, { timeout: 4000 }),
  ).toBeTruthy();
  expect(window.location.search).toBe("");

  await user.click(screen.getByRole("checkbox", { name: "Minecraft" }));
  await user.click(screen.getByRole("button", { name: "Suivant" }));
  expect(await screen.findByRole("heading", { name: "Tu joues surtout sur…" })).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Suivant" }).disabled).toBe(true);
  await user.click(screen.getByRole("radio", { name: "PC" }));
  await user.click(screen.getByRole("button", { name: "Suivant" }));
  expect(
    await screen.findByRole("heading", { name: "On te prévient pour les événements ?" }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Valider mes rôles" }));

  expect(
    await screen.findByRole("heading", { name: "Tes rôles sont à jour" }, { timeout: 4000 }),
  ).toBeTruthy();
  expect(screen.getByText("2 nouveaux rôles.")).toBeTruthy();
  const roles = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(roles).toEqual(["Membre", "Minecraft", "PC"]);
}, 15000);

test("unknown pages render the not-found page", async () => {
  window.history.replaceState(null, "", "/nope");
  render(<App config={mockConfig()} />);
  expect(await screen.findByRole("heading", { name: "Page introuvable" })).toBeTruthy();
});

test("public leaderboard of the levels plugin", async () => {
  window.history.replaceState(null, "", "/leaderboard");
  render(<App config={mockConfig()} />);
  expect(await screen.findByRole("heading", { level: 1, name: "Classement" })).toBeTruthy();
  const podium = await screen.findByRole("list", { name: "Top 3" }, { timeout: 4000 });
  expect(within(podium).getByText("Léa")).toBeTruthy();
  expect(screen.getByText("Malo")).toBeTruthy();
});

test("tickets: forbidden for members, listed for moderators", async () => {
  window.history.replaceState(null, "", "/tickets?cicord_token=signed");
  const { unmount } = render(<App config={mockConfig()} />);
  expect(
    await screen.findByText("Réservé à l'équipe de modération.", {}, { timeout: 4000 }),
  ).toBeTruthy();
  unmount();

  sessionStorage.clear();
  window.history.replaceState(null, "", "/tickets?role=moderator&cicord_token=signed");
  render(<App config={mockConfig()} />);
  expect(
    await screen.findByText("Problème d'accès au salon Valorant", {}, { timeout: 4000 }),
  ).toBeTruthy();
  expect(screen.queryByText("Idée de tournoi Minecraft")).toBeNull(); // open by default
  expect(screen.getByRole("link", { name: "Tickets" })).toBeTruthy();
}, 15000);

test("developers page maps the portal endpoints and plugin routes", async () => {
  window.history.replaceState(null, "", "/developers");
  render(<App config={mockConfig()} />);
  expect(await screen.findByRole("heading", { level: 1, name: "Développeurs" })).toBeTruthy();
  expect(screen.getByText("/api/v1/portal/ma-commu/banner")).toBeTruthy();
  expect(screen.getByText("cookie")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 3, name: /levels/ })).toBeTruthy();
});

test("pages toggles and locale come from the server config", async () => {
  const runtime = createMockRuntime();
  const patch = (s: Record<string, unknown>) => ({
    ...s,
    locale: "en",
    pages: { onboarding: true, profile: false, leaderboard: false, tickets: true },
  });
  const fetch: typeof runtime.fetch = async (input, init) => {
    const res = await runtime.fetch(input, init);
    if (!input.includes("/portal/") || input.includes("/plugins/") || input.endsWith("/me"))
      return res;
    const body = (await res.json()) as { items?: Record<string, unknown>[] } & Record<
      string,
      unknown
    >;
    const out = body.items ? { items: body.items.map(patch) } : patch(body);
    return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
  };
  window.history.replaceState(null, "", "/me");
  render(
    <App config={{ client: createCicordClient({ fetch }), login: () => undefined, mock: true }} />,
  );
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Leaderboard" })).toBeNull();
  expect(document.documentElement.lang).toBe("en");
});

test("auth mode follows the API origin", async () => {
  const { authModeFor } = await import("../src/config.ts");
  expect(authModeFor(undefined, undefined)).toBe("cookie");
  expect(authModeFor("https://cicord.example", undefined)).toBe("token");
  expect(authModeFor(window.location.origin, undefined)).toBe("cookie");
  expect(authModeFor("https://cicord.example", "cookie")).toBe("cookie");
});

test("a signed link to /leaderboard (levels /rank) signs in on that page", async () => {
  window.history.replaceState(null, "", "/leaderboard?cicord_token=signed");
  render(<App config={mockConfig()} />);
  expect(await screen.findByRole("heading", { level: 1, name: "Classement" })).toBeTruthy();
  expect(await screen.findByRole("link", { name: /Léa/ }, { timeout: 4000 })).toBeTruthy(); // user chip
  expect(window.location.search).toBe("");
});
