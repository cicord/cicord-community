import type { FetchLike } from "@cicord/client";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vite-plus/test";
import { authModeFor } from "../src/config.ts";
import { renderPortal } from "./render.tsx";

const nav = () => within(screen.getByRole("navigation", { name: "Portal" }));

test("signed out: the public landing, the server's links and a sign-in", async () => {
  renderPortal("/", { signedIn: false });
  expect(
    await screen.findByRole("heading", { level: 1, name: "The Cicord community" }),
  ).toBeTruthy();
  const links = within(screen.getByRole("list", { name: "Links" })).getAllByRole("link");
  expect(links.map((a) => a.textContent)).toEqual(["Documentation", "GitHub", "Join the Discord"]);
  expect(links[0]?.getAttribute("rel")).toBe("noopener noreferrer");
  expect(await screen.findByRole("button", { name: "Sign in with Discord" })).toBeTruthy();
  expect(nav().getByRole("link", { name: "Activity" })).toBeTruthy();
  expect(nav().queryByRole("link", { name: "Support queue" })).toBeNull();
  expect(nav().queryByRole("link", { name: "Profile" })).toBeNull();
  expect(document.title).toBe("The Cicord community");
});

test("a member sees their pages but not the support queue", async () => {
  renderPortal("/", { role: "member" });
  expect(await screen.findByRole("heading", { name: "Hi Alex" })).toBeTruthy();
  expect(nav().getByRole("link", { name: "My tickets" })).toBeTruthy();
  expect(nav().getByRole("link", { name: "Profile" })).toBeTruthy();
  expect(nav().queryByRole("link", { name: "Support queue" })).toBeNull();
  expect(screen.queryByRole("link", { name: /Support queue/ })).toBeNull();
});

test.each(["moderator", "admin"] as const)("a %s gets the support queue", async (role) => {
  renderPortal("/", { role });
  await screen.findByRole("heading", { name: /^Hi / });
  expect(nav().getByRole("link", { name: "Support queue" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Support queue.*Tickets waiting for the team/ }),
  ).toBeTruthy();
});

test("the support queue is for staff: a member gets a notice, never the queue", async () => {
  const { calls } = renderPortal("/support", { role: "member" });
  expect(await screen.findByRole("heading", { name: "For the support team" })).toBeTruthy();
  expect(calls.some((c) => c.path.includes("/plugins/cicord/tickets/tickets"))).toBe(false);
});

test("signed-out visitors are asked to sign in on member pages", async () => {
  renderPortal("/tickets", { signedIn: false });
  expect(await screen.findByRole("heading", { name: "My tickets" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign in with Discord" })).toBeTruthy();
});

test("a Discord account that is not a member is told so", async () => {
  const notMember =
    (fetch: FetchLike): FetchLike =>
    (input, init) =>
      input.endsWith("/portal/cicord/me")
        ? Promise.resolve(
            new Response(
              JSON.stringify({ error: { code: "forbidden", message: "not a member" } }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" },
              },
            ),
          )
        : fetch(input, init);
  renderPortal("/tickets", { wrap: notMember });
  expect(await screen.findByText(/not a member of this server yet/)).toBeTruthy();
});

test("tickets pages need the 0.2 routes: with tickets 0.1 they are not offered", async () => {
  const v01 =
    (fetch: FetchLike): FetchLike =>
    async (input, init) => {
      const res = await fetch(input, init);
      if (!/\/portal\/(servers|cicord)$/.test(new URL(input, "http://x").pathname)) return res;
      const body = (await res.json()) as Record<string, unknown> & {
        items?: Record<string, unknown>[];
      };
      const downgrade = (s: Record<string, unknown>) => ({
        ...s,
        plugins: (s["plugins"] as { plugin: string }[]).map((p) =>
          p.plugin === "tickets" ? { ...p, routes: ["GET /tickets", "GET /tickets/:id"] } : p,
        ),
      });
      const out = body.items ? { items: body.items.map(downgrade) } : downgrade(body);
      return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
    };
  renderPortal("/support", { role: "admin", wrap: v01 });
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
  expect(nav().queryByRole("link", { name: "My tickets" })).toBeNull();
  expect(nav().queryByRole("link", { name: "Support queue" })).toBeNull();
});

test("profile shows the member card and signs out", async () => {
  const user = userEvent.setup();
  renderPortal("/me", { role: "admin" });
  expect(await screen.findByRole("heading", { level: 2, name: "Morgan" })).toBeTruthy();
  expect(screen.getByText(/Maintainer\. Member since/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("button", { name: "Sign in with Discord" })).toBeTruthy();
  expect(window.location.pathname).toBe("/");
});

test("unknown pages render the not-found page", async () => {
  renderPortal("/nope");
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
});

test("auth mode follows the API origin", () => {
  expect(authModeFor(undefined, undefined)).toBe("cookie");
  expect(authModeFor("https://cicord.example", undefined)).toBe("token");
  expect(authModeFor(window.location.origin, undefined)).toBe("cookie");
  expect(authModeFor("https://cicord.example", "cookie")).toBe("cookie");
});
