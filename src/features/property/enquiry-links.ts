/**
 * Where the enquiry card's two links lead. Both ask sign-in to bring the visitor back to this home
 * (the address only, never a query: sign-in checks it again, BR-06); the first also says why they
 * came (`gate=enquire`), so the sign-in page can explain it.
 */
export function enquiryLinks(path: string): { signInHref: string; createAccountHref: string } {
  const back = encodeURIComponent(path);
  return {
    signInHref: `/auth?gate=enquire&redirect=${back}`,
    createAccountHref: `/auth?redirect=${back}`,
  };
}
