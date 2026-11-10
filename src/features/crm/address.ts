/**
 * The address of a call to a CRM: the base and the endpoint joined with one slash (S7-T09). Pure and free of server
 * code, so the delivery engine and the admin's cards (which run in the browser) say the same address.
 */
export function joinUrl(base: string, endpoint: string | null): string {
  if (!endpoint) return base;
  return `${base.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}
