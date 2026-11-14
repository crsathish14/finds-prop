import { createFakeAiProvider } from "../index";
import { defineConformanceSuite } from "./conformance";

// The reference: the fake must pass every case, so the other adapters are measured against a provider that is known to be right.
defineConformanceSuite("fake", {
  build: (rounds) => {
    const provider = createFakeAiProvider(rounds.map((round) => round.fake));
    return { provider, remaining: () => provider.remainingTurns };
  },
});
