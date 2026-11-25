import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vite-plus/test";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
