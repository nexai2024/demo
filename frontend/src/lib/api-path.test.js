import { describe, expect, it } from "vitest";
import { toApiPath, API } from "@/lib/api";

describe("toApiPath", () => {
  it("strips a relative /api prefix", () => {
    expect(toApiPath("/api/projects/p1/steps/s1/thumb")).toBe("/projects/p1/steps/s1/thumb");
  });

  it("strips /api from an absolute backend URL pathname", () => {
    // Production: VITE_BACKEND_URL=https://api.appshowcase.xyz → API ends with /api,
    // stepAsset builds a full URL, and pathname alone is /api/projects/...
    const absolute = "https://api.appshowcase.xyz/api/projects/p1/steps/s1/thumb?v=abc";
    expect(toApiPath(absolute)).toBe("/projects/p1/steps/s1/thumb?v=abc");
  });

  it("is a no-op for already-relative axios paths", () => {
    expect(toApiPath("/projects/p1/thumb")).toBe("/projects/p1/thumb");
  });

  it("handles the configured API prefix when it is relative", () => {
    if (API === "/api") {
      expect(toApiPath(`${API}/projects/p1`)).toBe("/projects/p1");
    }
  });
});
