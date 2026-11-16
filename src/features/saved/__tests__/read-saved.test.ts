import { describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/server/auth/session";
import { readSavedForSession } from "../read-saved";

const session: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

describe("readSavedForSession", () => {
  it("says signed in and lists the saved homes for a visitor with a session", async () => {
    const readShortIds = vi.fn().mockResolvedValue(["seedaabr", "seedaabs"]);
    await expect(readSavedForSession(session, readShortIds)).resolves.toEqual({
      signedIn: true,
      shortIds: ["seedaabr", "seedaabs"],
    });
  });

  it("says signed out and reads nothing for a visitor without a session", async () => {
    const readShortIds = vi.fn();
    await expect(readSavedForSession(null, readShortIds)).resolves.toEqual({
      signedIn: false,
      shortIds: [],
    });
    expect(readShortIds).not.toHaveBeenCalled();
  });
});
