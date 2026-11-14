import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./design-lab/helpers";
import en from "../src/i18n/messages/en.json";

// AI-P5-T02: the /ai-search page (ADR-128 section 10). The page exists only while FLAG_AI_SEARCH is on, and the
// flag is read when the server starts. CI starts it with the flag off, so there this file checks that the page and
// its navigation link are absent; the journey runs when the server is started with the flag on:
//
//   FLAG_AI_SEARCH=true AI_PROVIDER=fake npm run test:e2e:smoke
//
// The journey stubs `POST /api/ai/chat` in the browser. The real endpoint counts messages in the database and
// answers from a model, and this suite has neither a database nor a scripted model (the endpoint with
// `AI_PROVIDER=fake` has no script and fails closed); the endpoint itself is tested in
// src/features/ai-chat/endpoint. A real sign-in needs a phone code, so "sign in" is the visit to the sign-in page
// and the way back to /ai-search, which is what the browser does when the code is accepted.
// Text comes from en.json, so rewording a message never breaks a test (ADR-035).
const words = en.ai;
const flagOn = ["1", "true"].includes(process.env.FLAG_AI_SEARCH ?? "");

function lines(events: object[]): string {
  return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}

function answer(text: string): string {
  return lines([
    { type: "start", requestId: "e2e" },
    { type: "status", text: words.searching },
    { type: "text", text },
    { type: "done", outcome: "answered" },
  ]);
}

const gateBody = JSON.stringify({
  error: {
    code: "UNAUTHENTICATED",
    state: "sign_in_required",
    title: words.signInGateTitle,
    message: words.signInGateBody,
  },
  requestId: "e2e",
});

/** Answers the chat endpoint from the list, in order, and keeps what the page sent. */
async function stubEndpoint(page: Page, replies: ({ stream: string } | { gate: true })[]) {
  const sent: { role: string; text: string }[][] = [];
  await page.route("**/api/ai/chat", async (route) => {
    const body = route.request().postDataJSON() as { messages: { role: string; text: string }[] };
    sent.push(body.messages);
    const reply = replies[sent.length - 1];
    if (reply === undefined) {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    } else if ("gate" in reply) {
      await route.fulfill({ status: 401, contentType: "application/json", body: gateBody });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: reply.stream,
      });
    }
  });
  return sent;
}

// Which half is registered depends on how the server was started, so neither is skipped.
if (flagOn) {
  test.describe("@smoke AI chat page, flag on", () => {
    test("two free messages, the gate, sign in, and back to the same conversation", async ({
      page,
    }) => {
      const sent = await stubEndpoint(page, [
        { stream: answer("I found two homes in Velachery.") },
        { stream: answer("The larger one is 1,980 sq.ft.") },
        { gate: true },
      ]);
      await page.goto("/ai-search");

      // The first screen: heading, line, five prompts. A prompt fills the box and sends nothing.
      await expect(page.getByRole("heading", { level: 1, name: words.heading })).toBeVisible();
      await expect(page.getByText(words.intro)).toBeVisible();
      await expectNoSeriousAccessibilityViolations(page);
      const box = page.getByRole("textbox", { name: words.composer.label });
      await page.getByRole("button", { name: words.examples.emi }).click();
      await expect(box).toHaveValue(words.examples.emi);
      await expect(box).toBeFocused();
      expect(sent).toHaveLength(0);

      // Two free messages.
      await box.fill("3 BHK in Velachery");
      await page.getByRole("button", { name: words.composer.send }).click();
      await expect(page.getByText("I found two homes in Velachery.")).toBeVisible();
      await expect(box).toBeFocused();
      await box.fill("Which one is larger?");
      await box.press("Enter");
      await expect(page.getByText("The larger one is 1,980 sq.ft.")).toBeVisible();
      expect(sent[1]).toEqual([
        { role: "user", text: "3 BHK in Velachery" },
        { role: "assistant", text: "I found two homes in Velachery." },
        { role: "user", text: "Which one is larger?" },
      ]);

      // The third message meets the gate: the composer is replaced, the message is quoted and kept.
      await box.fill("Same size in Adyar?");
      await box.press("Enter");
      const gateHeading = page.getByRole("heading", { name: words.signInGateTitle });
      await expect(gateHeading).toBeFocused();
      await expect(page.getByText("Same size in Adyar?")).toBeVisible();
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await expectNoSeriousAccessibilityViolations(page);
      const signIn = page.locator("#main").getByRole("link", { name: words.gate.signIn });
      await expect(signIn).toHaveAttribute("href", "/auth?redirect=%2Fai-search");

      // Sign in (the phone code is checked by hand), then the way back: the same conversation, nothing sent.
      await signIn.click();
      await expect(page).toHaveURL(/\/auth\?redirect=/);
      await page.goto("/ai-search");
      await expect(page.getByText("I found two homes in Velachery.")).toBeVisible();
      await expect(page.getByText("The larger one is 1,980 sq.ft.")).toBeVisible();
      await expect(page.getByText("Same size in Adyar?")).toBeVisible();
      await expect(page.getByRole("heading", { name: words.signInGateTitle })).toBeVisible();
      expect(sent).toHaveLength(3);
    });

    test("shows an error with Try again, and sends the same message once more", async ({
      page,
    }) => {
      const sent = await stubEndpoint(page, [{ stream: "" }, { stream: answer("Here you are.") }]);
      await page.goto("/ai-search");
      const box = page.getByRole("textbox", { name: words.composer.label });
      await box.fill("hello");
      await box.press("Enter");
      const alert = page.getByRole("alert").filter({ hasText: words.errorTitle });
      await expect(alert).toBeVisible();
      await alert.getByRole("button", { name: words.notice.retry }).click();
      await expect(page.getByText("Here you are.")).toBeVisible();
      expect(sent[1]).toEqual([{ role: "user", text: "hello" }]);
    });
  });
} else {
  test.describe("@smoke AI chat page, flag off", () => {
    test("the page does not exist and the navigation does not point to it", async ({ page }) => {
      const response = await page.goto("/ai-search");
      expect(response?.status()).toBe(404);
      await page.goto("/");
      await expect(page.getByRole("link", { name: en.site.nav.aiSearch })).toHaveCount(0);
    });
  });
}
