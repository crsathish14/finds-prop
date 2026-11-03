/** Sends the browser to another address. One line, kept apart so a test can replace it. */
export function goTo(address: string): void {
  window.location.assign(address);
}
