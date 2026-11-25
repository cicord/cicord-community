import type { FetchLike } from "@cicord/client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vite-plus/test";
import { sortQueue } from "../src/tickets/Support.tsx";
import type { StaffTicket } from "../src/tickets/api.ts";
import { apiError, renderPortal } from "./render.tsx";

const TICKETS = "/api/v1/portal/cicord/plugins/cicord/tickets";

describe("members", () => {
  test("my tickets lists the viewer's tickets only", async () => {
    renderPortal("/tickets", { role: "member" });
    expect(await screen.findByText("Changelog ping role does not stick")).toBeTruthy();
    expect(screen.getByText("No open ticket.")).toBeTruthy();
    expect(screen.queryByText("Spam account DMing invite links")).toBeNull();
  });

  test("a ticket shows its status, assignee, label and history (no close reason)", async () => {
    renderPortal("/tickets/41", { role: "member" });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Changelog ping role does not stick" }),
    ).toBeTruthy();
    const details = within(screen.getByRole("complementary", { name: "Ticket details" }));
    expect(details.getByText("Morgan")).toBeTruthy();
    expect(details.getByText("Bug")).toBeTruthy();
    expect(screen.getByText("Morgan closed it")).toBeTruthy();
    expect(screen.queryByText(/reaction-roles 0\.1\.1/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Open in Discord" })).toBeNull();
  });

  test("someone else's ticket is not found", async () => {
    renderPortal("/tickets/47", { role: "member" });
    expect(await screen.findByText("This ticket does not exist, or it is not yours.")).toBeTruthy();
  });

  test("opening a ticket: validation, then the new ticket with its Discord channel", async () => {
    const user = userEvent.setup();
    const { calls } = renderPortal("/tickets/new", { role: "member" });
    const submit = await screen.findByRole("button", { name: "Open the ticket" });
    await user.click(submit);
    expect(screen.getByText("Write a subject of 3 to 100 characters.")).toBeTruthy();
    expect(screen.getByText("Write a description of 10 to 1000 characters.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Subject" }));
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    await user.type(screen.getByRole("textbox", { name: "Subject" }), "Webhook signatures");
    await user.type(
      screen.getByRole("textbox", { name: "Description" }),
      "How do I check webhook signatures in a plugin?",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Label (optional)" }), "plugin");
    await user.click(submit);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Webhook signatures" }),
    ).toBeTruthy();
    expect(window.location.pathname).toBe("/tickets/49");
    expect(screen.getByRole("link", { name: "Open in Discord" }).getAttribute("href")).toMatch(
      /^https:\/\/discord\.com\/channels\//,
    );
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      subject: "Webhook signatures",
      description: "How do I check webhook signatures in a plugin?",
      label: "plugin",
    });
  });

  test("a second open ticket answers 409 limit: a clear notice", async () => {
    const user = userEvent.setup();
    renderPortal("/tickets/new", { role: "member" });
    const fill = async () => {
      await user.type(await screen.findByRole("textbox", { name: "Subject" }), "First question");
      await user.type(
        screen.getByRole("textbox", { name: "Description" }),
        "Something to ask the team.",
      );
      await user.click(screen.getByRole("button", { name: "Open the ticket" }));
    };
    await fill();
    await screen.findByRole("heading", { level: 1, name: "First question" });
    await user.click(screen.getByRole("link", { name: "My tickets", current: "location" }));
    await user.click(await screen.findByRole("link", { name: "Open a ticket" }));
    await fill();
    expect(await screen.findByText("You already have an open ticket")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See my tickets" })).toBeTruthy();
    expect(window.location.pathname).toBe("/tickets/new");
  });
});

describe("staff", () => {
  test("the queue sorts by urgency then waiting time, and filters through the URL", async () => {
    const user = userEvent.setup();
    const { calls } = renderPortal("/support", { role: "moderator" });
    const list = await screen.findByRole("list", { busy: false });
    const subjects = within(list)
      .getAllByRole("link")
      .map((a) => a.querySelector(".ticket-row__subject")?.textContent);
    expect(subjects).toEqual([
      "Spam account DMing invite links",
      "Docker image fails to start with a Postgres URL",
      "The bot reverts my channel topic every few minutes",
      "Plugin review for the registry",
    ]);
    expect(screen.getByText("4 tickets, 2 unassigned")).toBeTruthy();

    await user.selectOptions(screen.getByRole("combobox", { name: "Assignee" }), "me");
    expect(window.location.search).toBe("?assignee=me");
    expect(await screen.findByText("1 ticket")).toBeTruthy();
    expect(screen.getByText("Spam account DMing invite links")).toBeTruthy();
    expect(calls.some((c) => c.path === `${TICKETS}/tickets?status=open&assignee=me`)).toBe(true);

    await user.selectOptions(screen.getByRole("combobox", { name: "Priority" }), "urgent");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "closed");
    expect(window.location.search).toBe("?status=closed&assignee=me&priority=urgent");
    expect(await screen.findByText("No ticket matches")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(window.location.search).toBe("");
  });

  test("sortQueue: open before closed, urgent first, longest waiting first", () => {
    const t = (id: string, extra: Partial<StaffTicket>): StaffTicket => ({
      id,
      number: Number(id),
      subject: id,
      status: "open",
      author: { id: "1", displayName: "A" },
      createdAt: "2026-11-01T00:00:00Z",
      closedAt: null,
      channelId: null,
      messages: 0,
      lastActivityAt: null,
      priority: "normal",
      label: null,
      assignee: null,
      source: "discord",
      ...extra,
    });
    const sorted = sortQueue([
      t("1", { status: "closed", closedAt: "2026-11-02T00:00:00Z" }),
      t("2", { lastActivityAt: "2026-11-20T00:00:00Z" }),
      t("3", { lastActivityAt: "2026-11-10T00:00:00Z" }),
      t("4", { priority: "urgent", lastActivityAt: "2026-11-24T00:00:00Z" }),
      t("5", { status: "closed", closedAt: "2026-11-05T00:00:00Z" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["4", "3", "2", "5", "1"]);
  });

  test("take it, priority and label are applied at once and saved", async () => {
    const user = userEvent.setup();
    const { calls } = renderPortal("/support/48", { role: "admin" });
    await screen.findByRole("heading", { level: 1, name: /channel topic/ });
    const assignee = screen.getByRole<HTMLSelectElement>("combobox", { name: "Assignee" });
    expect(assignee.value).toBe("");

    await user.click(screen.getByRole("button", { name: "Take it" }));
    expect(assignee.value).toBe("1001");
    expect(calls.find((c) => c.path.endsWith("/tickets/48/assign"))?.body).toEqual({
      userId: "me",
    });

    await user.selectOptions(screen.getByRole("combobox", { name: "Priority" }), "high");
    await user.selectOptions(screen.getByRole("combobox", { name: "Label" }), "bug");
    await waitFor(() => expect(screen.getByText("Morgan set the label to Bug")).toBeTruthy());
    expect(screen.getByText("Morgan set the priority to High")).toBeTruthy();
    expect(screen.getByText("Morgan assigned it to Morgan")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Take it" })).toBeNull();
    expect(calls.filter((c) => c.method === "PATCH").map((c) => c.body)).toEqual([
      { priority: "high" },
      { label: "bug" },
    ]);
  });

  test("a failed edit is rolled back and explained", async () => {
    const user = userEvent.setup();
    const failPatch =
      (fetch: FetchLike): FetchLike =>
      (input, init) =>
        init.method === "PATCH" ? Promise.resolve(apiError(400, "invalid")) : fetch(input, init);
    renderPortal("/support/48", { role: "admin", wrap: failPatch });
    const priority = await screen.findByRole<HTMLSelectElement>("combobox", { name: "Priority" });
    await user.selectOptions(priority, "urgent");
    expect(await screen.findByText("The change was not saved.")).toBeTruthy();
    await waitFor(() => expect(priority.value).toBe("normal"));
  });

  test("reply, close with a reason, reopen", async () => {
    const user = userEvent.setup();
    const { calls } = renderPortal("/support/47", { role: "moderator" });
    const reply = await screen.findByRole("textbox", { name: "Reply" });
    await user.type(reply, "The account is banned, thanks!");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    expect(
      await screen.findByText(/The account is banned, thanks!\s+— Sam \(via portal\)/),
    ).toBeTruthy();
    expect((reply as HTMLTextAreaElement).value).toBe("");

    await user.click(screen.getByRole("button", { name: "Close the ticket" }));
    await user.type(screen.getByRole("textbox", { name: "Reason" }), "Spammer banned.");
    await user.click(screen.getByRole("button", { name: "Close it" }));
    expect(await screen.findByRole("button", { name: "Reopen the ticket" })).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/close"))?.body).toEqual({
      reason: "Spammer banned.",
    });
    expect(screen.getByText("Sam closed it: Spammer banned.")).toBeTruthy();
    expect(screen.getByText("The ticket is closed. Reopen it to reply.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Reopen the ticket" }));
    expect(await screen.findByRole("textbox", { name: "Reply" })).toBeTruthy();
    expect(screen.getByText("Sam reopened it")).toBeTruthy();
  });

  test("a reply to a ticket closed meanwhile (409 closed) says so", async () => {
    const user = userEvent.setup();
    const closed =
      (fetch: FetchLike): FetchLike =>
      (input, init) =>
        input.endsWith("/messages") ? Promise.resolve(apiError(409, "closed")) : fetch(input, init);
    renderPortal("/support/47", { role: "moderator", wrap: closed });
    await user.type(await screen.findByRole("textbox", { name: "Reply" }), "Hello");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    expect(
      await screen.findByText("This ticket was closed meanwhile: reopen it to reply."),
    ).toBeTruthy();
  });

  test("a moderator without a staff role of the plugin (403) is told why", async () => {
    const forbidden =
      (fetch: FetchLike): FetchLike =>
      (input, init) =>
        input.includes(`${TICKETS}/tickets`) || input.endsWith(`${TICKETS}/staff`)
          ? Promise.resolve(apiError(403, "forbidden"))
          : fetch(input, init);
    renderPortal("/support", { role: "moderator", wrap: forbidden });
    expect(await screen.findByText("You are not on the support team")).toBeTruthy();
  });
});
