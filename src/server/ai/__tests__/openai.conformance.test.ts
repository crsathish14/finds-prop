import { createOpenAiProvider } from "../index";
import { defineConformanceSuite } from "./conformance";
import { createMockOpenAi, TEST_API_KEY, TEST_MODEL } from "./openai-mock";

// The OpenAI adapter over mocked HTTP: the real `openai` package runs, only its `fetch` is replaced. No network, no real key.
defineConformanceSuite("openai over mocked HTTP", {
  build: (rounds) => {
    const mock = createMockOpenAi(rounds.map((round) => round.openai()));
    const provider = createOpenAiProvider({
      apiKey: TEST_API_KEY,
      model: TEST_MODEL,
      fetch: mock.fetch,
    });
    return { provider, remaining: () => mock.remainingReplies };
  },
});
