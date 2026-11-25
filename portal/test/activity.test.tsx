import type { FetchLike } from "@cicord/client";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vite-plus/test";
import { heatLevel, niceMax } from "../src/activity/charts.tsx";
import { delta, formatOffset, peak, shiftHeatmap } from "../src/activity/data.ts";
import { mockAnalytics } from "../src/mock/analytics.ts";
import { renderPortal } from "./render.tsx";

/** A heatmap with one message per cell index (day * 24 + hour) at the given cells. */
function grid(cells: [day: number, hour: number, value: number][]): number[][] {
  const g = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const [d, h, v] of cells) g[d]![h] = v;
  return g;
}

describe("heatmap time zones", () => {
  test("a positive offset moves messages later, across midnight to the next day", () => {
    // Monday 23:00 UTC is Tuesday 01:00 in UTC+2.
    const out = shiftHeatmap(grid([[0, 23, 5]]), 120);
    expect(out[1]![1]).toBe(5);
    expect(out[0]![23]).toBe(0);
  });

  test("a negative offset moves messages earlier, Monday wraps to Sunday", () => {
    // Monday 02:00 UTC is Sunday 21:00 in UTC−5 (the data is a weekly profile).
    const out = shiftHeatmap(grid([[0, 2, 7]]), -300);
    expect(out[6]![21]).toBe(7);
  });

  test("Sunday wraps to Monday", () => {
    expect(shiftHeatmap(grid([[6, 23, 3]]), 60)[0]![0]).toBe(3);
  });

  test("offsets that are not whole hours are rounded, and nothing is lost", () => {
    const input = grid([
      [2, 10, 4],
      [4, 20, 9],
    ]);
    const india = shiftHeatmap(input, 330); // +5:30 → +6
    expect(india[2]![16]).toBe(4);
    expect(india[5]![2]).toBe(9);
    const newfoundland = shiftHeatmap(input, -210); // −3:30 → −3
    expect(newfoundland[2]![7]).toBe(4);
    const total = (g: number[][]) => g.flat().reduce((a, b) => a + b, 0);
    expect(total(india)).toBe(13);
    expect(total(newfoundland)).toBe(13);
  });

  test("offsets and peaks are labelled", () => {
    expect(formatOffset(0)).toBe("UTC");
    expect(formatOffset(60)).toBe("UTC+1");
    expect(formatOffset(-300)).toBe("UTC−5");
    expect(formatOffset(330)).toBe("UTC+5:30");
    expect(peak(grid([[3, 19, 12]]))).toEqual({ day: 3, hour: 19, value: 12 });
    expect(peak(grid([]))).toBeNull();
  });
});

test("deltas need a previous period with data", () => {
  expect(delta(110, 100)).toBeCloseTo(0.1);
  expect(delta(90, 100)).toBeCloseTo(-0.1);
  expect(delta(5, null)).toBeNull();
  expect(delta(5, 0)).toBeNull();
});

test("chart scales", () => {
  expect(niceMax(796)).toBe(1000);
  expect(niceMax(117)).toBe(200);
  expect(niceMax(0)).toBe(1);
  expect(heatLevel(0, 10)).toBe(0);
  expect(heatLevel(1, 10)).toBe(1);
  expect(heatLevel(10, 10)).toBe(4);
});

test("the mock analytics follow the API shape", () => {
  const data = mockAnalytics("7d", new Date("2026-11-25T12:00:00Z"));
  expect(data.from).toBe("2026-11-19T00:00:00Z");
  expect(data.to).toBe("2026-11-26T00:00:00Z");
  expect(data.kpis.map((k) => k.metric)).toEqual([
    "members.total",
    "members.joined",
    "members.active",
    "messages.sent",
    "voice.seconds",
    "reactions.added",
    "bots.commands",
    "members.active.bots",
  ]);
  expect(data.kpis.every((k) => k.spark.length === 7)).toBe(true);
  expect(data.heatmap).toHaveLength(7);
  expect(data.heatmap.every((row) => row.length === 24)).toBe(true);
});

test("the activity page shows KPIs, charts with tables, rankings and the heatmap", async () => {
  renderPortal("/activity");
  expect(await screen.findByRole("heading", { level: 1, name: "Community activity" })).toBeTruthy();
  const kpis = within(await screen.findByRole("list", { name: "Key figures" }));
  expect(kpis.getAllByRole("listitem")).toHaveLength(8);
  expect(kpis.getByText("Members")).toBeTruthy();
  expect(kpis.getByText("Time in voice")).toBeTruthy();
  expect(kpis.getAllByText(/vs previous 30 days/).length).toBeGreaterThan(0);

  const messages = screen.getByRole("figure", { name: "Messages per day" });
  // The data table alternative: one row per day.
  expect(within(messages).getAllByRole("row")).toHaveLength(31);
  const slider = within(messages).getByRole("slider");
  fireEvent.change(slider, { target: { value: "0" } });
  expect(slider.getAttribute("aria-valuetext")).toMatch(/^\w{3} \d+: [\d,]+ messages$/);

  expect(screen.getByText("#general")).toBeTruthy();
  expect(screen.getByText("/poll")).toBeTruthy();
  const heatmap = screen.getByRole("table", { name: /When the server is busy/ });
  expect(within(heatmap).getAllByRole("row")).toHaveLength(8);
  expect(screen.getAllByText(/In your time zone/).length).toBeGreaterThan(0);
});

test("switching the period keeps it in the URL", async () => {
  const user = userEvent.setup();
  const { calls } = renderPortal("/activity");
  await user.click(await screen.findByRole("radio", { name: "7 days" }));
  expect(window.location.search).toBe("?period=7d");
  expect(await screen.findAllByText(/vs previous 7 days/)).not.toHaveLength(0);
  expect(calls.some((c) => c.path.endsWith("/analytics?period=7d"))).toBe(true);
});

test("a server that does not share its activity shows an empty state", async () => {
  renderPortal("/activity", { analytics: "off", role: "member" });
  expect(await screen.findByRole("heading", { name: "Activity is not shared yet" })).toBeTruthy();
  expect(screen.queryByText(/spec\.analytics\.portal/)).toBeNull();
});

test("staff get the hint to turn activity sharing on", async () => {
  renderPortal("/activity", { analytics: "off", role: "admin" });
  expect(await screen.findByText(/spec\.analytics\.portal/)).toBeTruthy();
});

test("members-only activity asks signed-out visitors to sign in", async () => {
  renderPortal("/activity", { analytics: "members", signedIn: false });
  expect(await screen.findByRole("heading", { name: "Activity is for members" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Sign in with Discord" }).length).toBeGreaterThan(0);
});

test("public activity is shown to signed-out visitors", async () => {
  renderPortal("/activity", { analytics: "public", signedIn: false });
  expect(await screen.findByRole("list", { name: "Key figures" })).toBeTruthy();
});

test("a server that just started collecting: zeros and empty sparks", async () => {
  // As served by a fresh runtime: some sparks empty, members.total with today only.
  const fresh =
    (fetch: FetchLike): FetchLike =>
    async (input, init) => {
      if (!input.includes("/analytics")) return fetch(input, init);
      const zeros = [1795046400, 1795132800, 1795219200].map((t) => [t, 0]);
      const kpi = (metric: string, spark: number[][], value = 0) => ({
        metric,
        value,
        previous: null,
        spark,
      });
      const body = {
        server: "cicord",
        period: "7d",
        from: "2026-11-19T00:00:00Z",
        to: "2026-11-26T00:00:00Z",
        since: "2026-11-25T10:00:00Z",
        kpis: [
          kpi("members.total", [[1795564800, 1]], 1),
          kpi("members.joined", zeros),
          kpi("members.active", []),
          kpi("messages.sent", zeros),
          kpi("voice.seconds", zeros),
          kpi("reactions.added", zeros),
          kpi("bots.commands", zeros),
          kpi("members.active.bots", []),
        ],
        topChannels: [],
        topBotCommands: [],
        heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
      };
      return new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      });
    };
  renderPortal("/activity", { wrap: fresh });
  expect(await screen.findByText(/Data starts on Nov 25\./)).toBeTruthy();
  expect(screen.getAllByText("Nothing recorded over this period yet.")).toHaveLength(2);
  expect(screen.queryByRole("slider")).toBeNull();
  expect(screen.getAllByText("No earlier period to compare")).toHaveLength(8);
  expect(screen.getByText("No messages in public channels over this period.")).toBeTruthy();
  expect(screen.getByText("No bot commands over this period.")).toBeTruthy();
});
