"use server";

import { defineAction } from "@/server/actions/define-action";
import { getSessionView } from "@/server/auth/get-session-view";
import { readSavedHomesConfig, saveHomeConfig, unsaveHomeConfig } from "./action-config";
import { savedShortIds } from "./queries";
import { readSavedForSession } from "./read-saved";
import { savedStore } from "./store";
import { saveHome, unsaveHome } from "./service";

/** Saves a home for the signed-in visitor with a verified phone. Saving it again changes nothing. */
export const saveHomeAction = defineAction({
  ...saveHomeConfig,
  handler: async ({ input }) => saveHome(await savedStore(), input.shortId),
});

/** Removes a home from the visitor's saved homes. */
export const unsaveHomeAction = defineAction({
  ...unsaveHomeConfig,
  handler: async ({ input }) => unsaveHome(await savedStore(), input.shortId),
});

/**
 * Who is signed in, and which of the visible homes they saved. The header and the home cards ask for
 * it once when they load, so each card can draw its heart as saved. A visitor who is not signed in
 * gets no homes and no error.
 */
export const readSavedHomes = defineAction({
  ...readSavedHomesConfig,
  // The action is open to everyone, so defineAction passes no session; read it here.
  handler: async () => readSavedForSession(await getSessionView(), savedShortIds),
});
