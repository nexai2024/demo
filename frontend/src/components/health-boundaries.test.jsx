import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";
import { BackendHealthBanner } from "./BackendHealthBanner";
import axios from "axios";

vi.mock("axios", () => ({
  __esModule: true,
  default: { get: vi.fn() },
}));
vi.mock("@/lib/activity", () => ({ recordActivity: vi.fn() }));
vi.mock("@/lib/api", () => ({ API: "/api" }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const Boom = () => {
  throw new Error("kaboom render");
};

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
const renderUI = async (ui) => {
  await act(async () => root.render(ui));
};

test("route boundary shows fallback instead of blank screen", async () => {
  await renderUI(
    <ErrorBoundary variant="route" label="Dashboard">
      <Boom />
    </ErrorBoundary>,
  );
  expect(container.querySelector('[data-testid="route-error"]')).toBeTruthy();
  expect(container.textContent).toMatch(/Dashboard hit an error/);
  expect(container.textContent).toMatch(/kaboom render/);
});

test("quiet boundary renders nothing on error", async () => {
  await renderUI(
    <ErrorBoundary quiet label="Activity dock">
      <Boom />
    </ErrorBoundary>,
  );
  expect(container.innerHTML).toBe("");
});

test("banner lists config_problems from /api/ready 503", async () => {
  axios.get.mockResolvedValue({
    status: 503,
    data: {
      config_ok: false,
      database_ok: true,
      storage_ok: false,
      config_problems: ["JWT_SECRET must be at least 32 characters"],
      startup_error: null,
    },
  });
  await renderUI(<BackendHealthBanner />);
  expect(container.querySelector('[data-testid="backend-not-ready-banner"]')).toBeTruthy();
  expect(container.textContent).toMatch(/JWT_SECRET must be at least 32 characters/);
  expect(container.textContent).toMatch(/Object storage is not ready/);
  await act(async () => {
    container.querySelector('[data-testid="backend-health-dismiss"]').click();
  });
  expect(container.querySelector('[data-testid="backend-not-ready-banner"]')).toBeNull();
});

test("banner stays hidden when backend is ready", async () => {
  axios.get.mockResolvedValue({
    status: 200,
    data: { config_ok: true, database_ok: true, storage_ok: true, config_problems: [] },
  });
  await renderUI(<BackendHealthBanner />);
  expect(container.querySelector('[data-testid="backend-not-ready-banner"]')).toBeNull();
});

test("banner detects misrouted API (HTML instead of JSON)", async () => {
  axios.get.mockResolvedValue({ status: 200, data: "<html>index</html>" });
  await renderUI(<BackendHealthBanner />);
  expect(container.textContent).toMatch(/returned a web page instead of JSON/);
});
