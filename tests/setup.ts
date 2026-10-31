import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Component tests render into jsdom; remove what a test rendered before the next one starts.
afterEach(() => cleanup());

// jsdom has no ResizeObserver, which Radix controls (checkbox, switch, tooltip) read.
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", { value: ResizeObserverStub });
}
