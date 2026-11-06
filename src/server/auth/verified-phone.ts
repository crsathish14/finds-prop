import "server-only";
import { ActionError } from "@/server/actions/normalise-error";
import { createServerSupabase } from "@/server/supabase/server";

/**
 * The signed-in account's own phone as digits (`919840012345`), from the verified token. A lead's or a
 * form's phone is this number and never one typed in a form, so a request cannot be sent for someone
 * else's number. The action has already required a verified phone; this refuses again if the token has
 * none. Shared by the project lead action and the project form action.
 */
export async function verifiedPhoneDigits(): Promise<string> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const phone = data?.claims.phone;
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  if (error || !/^[0-9]{6,15}$/.test(digits)) {
    throw new ActionError("FORBIDDEN", "A verified phone number is required.", {
      reason: "PHONE_NOT_VERIFIED",
    });
  }
  return digits;
}
