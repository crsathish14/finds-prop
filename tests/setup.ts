import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Component tests render into jsdom; remove what a test rendered before the next one starts.
afterEach(() => cleanup());
