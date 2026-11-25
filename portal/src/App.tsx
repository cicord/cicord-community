import { CicordProvider } from "@cicord/react";
import { useState } from "react";
import { Activity } from "./activity/Activity.tsx";
import type { PortalConfig } from "./config.ts";
import { Developers } from "./pages/Developers.tsx";
import { Home } from "./pages/Home.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { Profile } from "./pages/Profile.tsx";
import { ConfigProvider, ServerGate, Shell, usePages } from "./portal.tsx";
import { usePathname } from "./router.tsx";
import { MyTicketView, MyTickets, NewTicket } from "./tickets/MyTickets.tsx";
import { SupportQueue, SupportTicket } from "./tickets/Support.tsx";

/** `/tickets/12` → "12" (decoded; the API module encodes it again). */
function idAfter(path: string, prefix: string): string | undefined {
  if (!path.startsWith(prefix)) return undefined;
  const rest = path.slice(prefix.length);
  if (!rest || rest.includes("/")) return undefined;
  try {
    return decodeURIComponent(rest);
  } catch {
    return undefined;
  }
}

/**
 * Routes. Pages turned off with `spec.portal.pages`, or whose plugin does not serve their
 * routes, answer "not found".
 */
function Page() {
  const path = usePathname();
  const pages = usePages();
  if (path === "/") return <Home />;
  if (path === "/activity") return <Activity />;
  if (path === "/me") return pages.profile ? <Profile /> : <NotFound />;
  if (path === "/developers") return <Developers />;
  if (pages.myTickets) {
    if (path === "/tickets") return <MyTickets />;
    if (path === "/tickets/new") return <NewTicket />;
    const id = idAfter(path, "/tickets/");
    if (id) return <MyTicketView key={id} id={id} />;
  }
  if (pages.support) {
    if (path === "/support") return <SupportQueue />;
    const id = idAfter(path, "/support/");
    if (id) return <SupportTicket key={id} id={id} />;
  }
  return <NotFound />;
}

export function App({ config }: { config: PortalConfig }) {
  const [server, setServer] = useState<string | undefined>(undefined);
  return (
    <ConfigProvider value={config}>
      <CicordProvider client={config.client} server={server}>
        <ServerGate onServer={setServer}>
          <Shell>
            <Page />
          </Shell>
        </ServerGate>
      </CicordProvider>
    </ConfigProvider>
  );
}
