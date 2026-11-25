/** A deliberately tiny History API router (a handful of pages do not need a dependency). */
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const EVENT = "cicord:navigate";

function subscribe(listener: () => void): () => void {
  window.addEventListener("popstate", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(EVENT, listener);
  };
}

/** The current path, without its trailing slash ("/" for the home page). */
export function usePathname(): string {
  const path = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => "/",
  );
  return path.replace(/\/+$/, "") || "/";
}

/** The current query string ("" or "?…"), where list pages keep their filters. */
export function useSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
}

export function navigate(to: string, options: { replace?: boolean; scroll?: boolean } = {}): void {
  if (options.replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  window.dispatchEvent(new Event(EVENT));
  if (options.scroll ?? true) window.scrollTo({ top: 0 });
}

/** Replaces the query string of the current page (filters), without scrolling. */
export function setSearch(params: URLSearchParams): void {
  const query = params.toString();
  navigate(`${window.location.pathname}${query ? `?${query}` : ""}`, {
    replace: true,
    scroll: false,
  });
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
  return (
    <a {...rest} href={to} onClick={handle}>
      {children}
    </a>
  );
}
