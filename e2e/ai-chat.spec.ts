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
//
// AI-P6-T02, the confirm card: the card arrives as a `confirm` event of the stubbed stream, and the Send button's
// Server Action (`confirmChatProposal`) is stubbed too: the browser's POST to the page carries a `Next-Action` header
// and gets a `text/x-component` answer whose first row points at the second (`0:{"a":"$@1"}`, `1:{...result}`),
// which is how Next.js answers an action. The real action (the proposal check, the account's name and phone, the two
// existing actions) is tested in src/features/ai-chat/confirm/__tests__ with the real defineAction.
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

const MESSAGE = "Is this home still available? I would like to visit this Saturday.";

const confirmStream = lines([
  { type: "start", requestId: "e2e" },
  { type: "status", text: words.searching },
  { type: "text", text: "I have prepared an enquiry. Check it and press Send." },
  {
    type: "confirm",
    card: {
      state: "ready",
      kind: "enquiry",
      proposal: "body.signature",
      target: { title: "3 BHK apartment", meta: "Velachery · ₹1.25 Cr" },
      name: "Priya Raman",
      phone: "+91 98400 12345",
      message: MESSAGE,
    },
  },
  { type: "done", outcome: "answered" },
]);

/** Answers the Send button's Server Action with this result, and keeps what the browser sent. */
async function stubConfirmAction(page: Page, result: object) {
  const sent: string[] = [];
  await page.route("**/ai-search", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || request.headers()["next-action"] === undefined) {
      await route.fallback();
      return;
    }
    sent.push(request.postData() ?? "");
    await route.fulfill({
      status: 200,
      contentType: "text/x-component",
      body: `0:{"a":"$@1"}\n1:${JSON.stringify(result)}\n`,
    });
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

    test("the confirm card sends only when its own button is pressed, and then says so", async ({
      page,
    }) => {
      const sent = await stubEndpoint(page, [
        { stream: confirmStream },
        { stream: answer("Please press the Send button on the card.") },
      ]);
      const actions = await stubConfirmAction(page, { ok: true, data: { received: true } });
      await page.goto("/ai-search");
      const box = page.getByRole("textbox", { name: words.composer.label });
      await box.fill("Please ask the owner of the 3 BHK in Velachery if it is available");
      await box.press("Enter");

      // The card shows the real target, the account's name and phone, and the message: nothing is sent yet.
      const card = page.getByRole("region", { name: words.confirm.enquiryTitle });
      await expect(card).toBeVisible();
      await expect(card.getByText("3 BHK apartment")).toBeVisible();
      await expect(card.getByText("Priya Raman")).toBeVisible();
      await expect(card.getByText("+91 98400 12345")).toBeVisible();
      await expect(card.getByText(MESSAGE)).toBeVisible();
      await expectNoSeriousAccessibilityViolations(page);
      expect(actions).toHaveLength(0);

      // Typing "yes" is only another message to the assistant.
      await box.fill("yes");
      await box.press("Enter");
      await expect(page.getByText("Please press the Send button on the card.")).toBeVisible();
      expect(sent).toHaveLength(2);
      expect(actions).toHaveLength(0);

      // The button sends the signed proposal and a fresh key, once.
      await card.getByRole("button", { name: en.domain.enquiry.form.send }).click();
      await expect(page.getByRole("heading", { name: en.domain.enquiry.sent.title })).toBeVisible();
      expect(actions).toHaveLength(1);
      expect(actions[0]).toContain("body.signature");
      expect(actions[0]).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    });

    test.describe("on a phone", () => {
      test.use({ viewport: { width: 390, height: 844 } });

      // ADR-220: below lg the chat and the cards page are two panes of a pager. The page itself does not scroll.
      test("the cards sit on their own pane, reached by the line, left by the back button", async ({
        page,
      }) => {
        await stubEndpoint(page, [
          {
            stream: lines([
              { type: "start", requestId: "e2e" },
              { type: "text", text: "I found one home in Velachery." },
              {
                type: "card",
                reference: { kind: "home", homeId: "ab12cd34", slug: "3-bhk-velachery" },
              },
              { type: "done", outcome: "answered" },
            ]),
          },
        ]);
        await stubConfirmAction(page, {
          ok: true,
          data: [
            {
              kind: "home",
              key: "home:ab12cd34",
              shortId: "ab12cd34",
              card: {
                href: "/properties/ab12cd34",
                title: "3 BHK apartment",
                locality: "Velachery",
                city: "Chennai",
                rupees: 12500000,
                listingType: "sale",
                cover: null,
              },
            },
          ],
        });
        await page.goto("/ai-search");
        const pager = page.locator('[data-slot="ai-chat-pager"]');
        const cardsPane = page.locator('[data-slot="ai-cards-aside"]');
        const box = page.getByRole("textbox", { name: words.composer.label });
        await box.fill("3 BHK in Velachery");
        await page.getByRole("button", { name: words.composer.send }).click();

        // The chat holds the words and the line; the card is on the other pane, out of reach.
        const line = page.getByRole("button", { name: "1 home on the right" });
        await expect(line).toBeVisible();
        await expect(pager).toHaveAttribute("data-pane", "chat");
        await expect(cardsPane).toHaveAttribute("inert", "");
        // The page does not scroll: the chat scrolls inside its own box and the message box sits under it.
        expect(
          await page.evaluate(
            () => document.documentElement.scrollHeight <= window.innerHeight + 1,
          ),
        ).toBe(true);
        await expect(box).toBeInViewport();
        await expectNoSeriousAccessibilityViolations(page);

        // The line slides the cards in; the back button returns to the chat.
        await line.click();
        await expect(pager).toHaveAttribute("data-pane", "cards");
        const card = page.getByRole("link", { name: /3 BHK apartment/ });
        await expect(card).toBeInViewport();
        // There is nothing to type to on the cards pane, so the message box gives its height to the cards.
        await expect(page.getByRole("textbox")).toHaveCount(0);
        await expectNoSeriousAccessibilityViolations(page);
        await page.getByRole("button", { name: words.pager.back }).click();
        await expect(pager).toHaveAttribute("data-pane", "chat");
        await expect(line).toBeInViewport();
        await expect(box).toBeInViewport();
      });
    });

    test("when the session has ended, the card says so, and the message comes back after signing in", async ({
      page,
    }) => {
      await stubEndpoint(page, [{ stream: confirmStream }]);
      const actions = await stubConfirmAction(page, { ok: false, code: "UNAUTHENTICATED" });
      await page.goto("/ai-search");
      const box = page.getByRole("textbox", { name: words.composer.label });
      await box.fill("Please ask the owner of the 3 BHK in Velachery if it is available");
      await box.press("Enter");
      const card = page.getByRole("region", { name: words.confirm.enquiryTitle });
      await card.getByRole("button", { name: en.domain.enquiry.form.send }).click();

      // Nothing was sent; the card is the sign-in prompt for an ended session, with the message kept.
      await expect(page.getByRole("heading", { name: en.domain.sessionEnded.title })).toBeFocused();
      await expect(page.getByText(MESSAGE)).toBeVisible();
      const signIn = page.getByRole("link", { name: en.domain.sessionEnded.action });
      await expect(signIn).toHaveAttribute("href", "/auth?gate=expired&redirect=%2Fai-search");
      expect(actions).toHaveLength(1);

      // Sign in (the phone code is checked by hand), then the way back: the message is in the box, unsent.
      await signIn.click();
      await expect(page).toHaveURL(/\/auth\?gate=expired/);
      await page.goto("/ai-search");
      await expect(page.getByRole("textbox", { name: words.composer.label })).toHaveValue(MESSAGE);
      expect(actions).toHaveLength(1);
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
