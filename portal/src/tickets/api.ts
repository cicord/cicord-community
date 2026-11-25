/**
 * The `tickets` plugin (0.2) for the portal pages: its types, taken from the route contract
 * that `cicord portal typegen` generates into src/cicord-routes.d.ts (`PluginRouteRegistry`),
 * the labels, the limits, and the optimistic edits of the staff view.
 *
 * Pages call the routes with `useRouteQuery("tickets", …)` and `useRouteMutation("tickets",
 * …)` from @cicord/react, which find the instance by plugin name in `PortalServer.plugins`
 * (never a hard-coded bot or instance key: they belong to the repository).
 *
 * Errors are `{error: {code, message}}` bodies: 400 `invalid`, 403 `forbidden` (not on the
 * support team), 404 `not_found` (no such ticket, or not the viewer's), 409 `limit` (too many
 * open tickets), `closed` (the ticket is closed) or `open` (reopening an open ticket).
 */
import {
  resolveRoute,
  type PortalPlugin,
  type RouteResponseOf,
  type RoutesOf,
} from "@cicord/client";
import { cicordKeys, useCicord, usePortalPlugin, useServerKey } from "@cicord/react";
import { useCallback } from "react";

// ───────────────────────────────────────────────────────────── types (generated contract)

type Routes = RoutesOf<"tickets">;
type Response<K extends keyof Routes> = RouteResponseOf<Routes[K]>;

/** One of the viewer's own tickets. */
export type MyTicket = Response<"GET /tickets/mine">["items"][number];
export type MyTicketDetail = Response<"GET /tickets/mine/:id">;
/** One item of the support queue. */
export type StaffTicket = Response<"GET /tickets">["items"][number];
export type StaffTicketDetail = Response<"GET /tickets/:id">;
/** A Discord user as the server shows them. */
export type Person = Response<"GET /staff">["items"][number];
export type TicketStatus = StaffTicket["status"];
export type Priority = StaffTicket["priority"];
export type Label = NonNullable<StaffTicket["label"]>;
/** A timeline entry (the last 100 are kept). */
export type TicketEvent = StaffTicketDetail["events"][number];
/** A timeline entry as the member sees it (names only). */
export type MyTicketEvent = MyTicketDetail["events"][number];
export type TicketEventType = MyTicketEvent["type"];
/** A message of the ticket channel (the last 50, oldest first). */
export type TicketMessage = NonNullable<StaffTicketDetail["messages"]>[number];
/** The queue filters of `GET /tickets`. */
export type StaffTicketQuery = NonNullable<Routes["GET /tickets"]["query"]>;

// ───────────────────────────────────────────────────────────── constants

/** Limits enforced by the plugin, checked here too for immediate feedback. */
export const LIMITS = {
  subject: { min: 3, max: 100 },
  description: { min: 10, max: 1000 },
  reply: { min: 1, max: 2000 },
  reason: { max: 500 },
} as const;

export const PRIORITIES: readonly Priority[] = ["low", "normal", "high", "urgent"];

/**
 * The labels members and staff pick from (tickets config `labels`; these are the plugin's
 * defaults, which bots/cicord/bot.yaml keeps). The plugin returns a ticket's label as an
 * object, so only the pickers need this list; it goes once the plugin serves its labels.
 */
export const TICKET_LABELS: readonly Label[] = [
  { key: "question", name: "Question", emoji: "❓" },
  { key: "bug", name: "Bug", emoji: "🐛" },
  { key: "self-hosting", name: "Self-hosting", emoji: "🖥️" },
  { key: "plugin", name: "Plugin", emoji: "🧩" },
  { key: "other", name: "Other", emoji: null },
];

/** The first route that tells a tickets instance speaks the 0.2 member contract. */
export const MEMBER_ROUTE = "GET /tickets/mine";
/** Only 0.2 serves the staff list: the queue is not offered against 0.1. */
export const STAFF_ROUTE = "GET /staff";

/** The tickets instance of the server (by plugin name), when it serves `route`. */
export function useTicketsPlugin(route: string): PortalPlugin | undefined {
  const { instance } = usePortalPlugin("tickets");
  return instance?.routes.includes(route) ? instance : undefined;
}

// ───────────────────────────────────────────────────────────── optimistic edits

/**
 * Optimistic edits of a staff ticket (assign, priority, label): the detail cached by
 * `useRouteQuery("tickets", "GET /tickets/:id")` is patched at once, the request is sent,
 * then the detail is merged with the ticket the plugin returns and every query of the
 * instance is refetched. On error the previous detail is restored and the error rethrown.
 */
export function useOptimisticTicket(id: string) {
  const { client, cache } = useCicord();
  const plugin = useTicketsPlugin("GET /tickets/:id");
  const server = useServerKey();
  return useCallback(
    async <K extends "POST /tickets/:id/assign" | "PATCH /tickets/:id">(
      route: K,
      body: Routes[K]["body"],
      patch: (ticket: StaffTicketDetail) => StaffTicketDetail,
    ): Promise<StaffTicket> => {
      if (!plugin || !server) throw new Error(`tickets: ${route} is not available on this server`);
      const [, detailPath] = resolveRoute("GET /tickets/:id", { id });
      // The key useRouteQuery uses for this route (no query).
      const key = cicordKeys.plugin(server, plugin.bot, plugin.instance, detailPath);
      const before = cache.getState<StaffTicketDetail>(key).data;
      if (before) cache.setData(key, patch(before));
      try {
        const [method, path] = resolveRoute(route, { id });
        const ticket = await client
          .plugin(server, plugin.bot, plugin.instance)
          .request<StaffTicket>(method, path, { body });
        // `messages` (a count here, the conversation in the detail) and `channelId` (null
        // once closed here, the last channel in the detail) do not mean the same in both.
        const { messages, channelId: _channel, ...fields } = ticket;
        cache.setData<StaffTicketDetail | undefined>(key, (current) =>
          current ? { ...current, ...fields, messageCount: messages } : current,
        );
        return ticket;
      } catch (error) {
        if (before) cache.setData(key, before);
        throw error;
      } finally {
        void cache.invalidate(["cicord", "plugin", server, plugin.bot, plugin.instance]);
      }
    },
    [client, cache, plugin, server, id],
  );
}
