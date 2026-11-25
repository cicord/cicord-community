/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the Cicord runtime when the portal is hosted elsewhere (CORS). Default: same origin. */
  readonly VITE_CICORD_API_URL?: string;
  /**
   * "cookie" | "token". Default: "token" when VITE_CICORD_API_URL is another origin (embedded
   * portal: bearer session token), else "cookie".
   */
  readonly VITE_CICORD_AUTH?: string;
  /** Server key to show when the URL has no ?server= (default: the first portal server). */
  readonly VITE_CICORD_SERVER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
