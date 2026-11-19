/**
 * Test helpers for the shared Select, which is a Radix listbox rather than the browser's <select>.
 * `pickValue` opens it and clicks the option with that value (or text); `optionTexts` lists the labels the
 * open list offers; `selectedValue` reads the value it holds.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export async function pickValue(trigger: HTMLElement, value: string) {
  await userEvent.click(trigger);
  const option = await waitFor(() => {
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    const found =
      options.find((option) => option.dataset.value === value) ??
      options.find((option) => option.textContent === value);
    if (!found) throw new Error(`No option with value or text "${value}"`);
    return found;
  });
  await userEvent.click(option);
}

export async function optionTexts(trigger: HTMLElement) {
  await userEvent.click(trigger);
  const list = await screen.findByRole("listbox");
  const texts = [...list.querySelectorAll('[role="option"]')].map((option) => option.textContent);
  await userEvent.keyboard("{Escape}");
  return texts;
}

/** Changes a field the way a visitor would: a Select is opened and clicked, anything else is typed into. */
export async function changeField(field: HTMLElement, value: string) {
  if (field.getAttribute("data-slot") === "select") {
    await pickValue(field, value);
    return;
  }
  fireEvent.change(field, { target: { value } });
}
