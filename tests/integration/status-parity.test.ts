import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canTransition,
  ENQUIRY_STATUSES,
  LISTING_STATUSES,
  type EnquiryState,
  type ListingStatus,
} from "@/lib/status-machine";
import { adminClient } from "./support/clients";

// IT-status-parity (S6-T05): the status machines in code (`src/lib/status-machine.ts`) replayed against the
// database triggers. Every pair of states is tried; the trigger must allow it exactly when the table does, so the
// screens' idea of what is allowed can never drift from the database's.

const RUN = randomUUID().slice(0, 8);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const madeUpShortId = () =>
  Array.from({ length: 8 }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join("");

describe("IT-status-parity: the listing machine against guard_properties (S6-T05)", () => {
  const admin = adminClient();
  let ownerId: string;
  const made: string[] = [];

  beforeAll(async () => {
    const email = `it-status-parity-${RUN}@example.test`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("Could not create the owner");
    ownerId = created.data.user.id;
  });

  afterAll(async () => {
    if (made.length > 0) await admin.from("properties").delete().in("id", made);
    await admin.auth.admin.deleteUser(ownerId);
  });

  /** A complete listing made in the given state by the system, as the seed and the functions do. */
  async function listingIn(status: ListingStatus): Promise<string> {
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: ownerId,
        short_id: madeUpShortId(),
        slug: `it-status-parity-${randomUUID()}`,
        status,
        ...(status === "rejected" ? { rejection_reason: "Add a photo of the home." } : {}),
        listing_type: "sale",
        property_type: "apartment",
        title: `Home for the status table ${RUN}`,
        description: "A bright flat.",
        price: 8500000,
        area_sqft: 950,
        locality: "Adyar",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600020",
        address: "12 Beach Road",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create a ${status} listing (${error.code})`);
    made.push(data.id);
    return data.id;
  }

  const pairs = LISTING_STATUSES.flatMap((from) =>
    LISTING_STATUSES.filter((to) => to !== from).map((to) => [from, to] as const),
  );

  it.each(pairs)(
    "%s to %s is allowed by the trigger exactly when the table allows it",
    async (from, to) => {
      const id = await listingIn(from);
      const { error } = await admin
        .from("properties")
        .update({
          status: to,
          ...(to === "rejected" ? { rejection_reason: "Not clear enough." } : {}),
        })
        .eq("id", id);
      if (canTransition("listing", from, to)) {
        expect(error, `${from}>${to} should be allowed`).toBeNull();
        const { data } = await admin.from("properties").select("status").eq("id", id).single();
        expect(data?.status).toBe(to);
      } else {
        expect(error?.message, `${from}>${to} should be refused`).toContain(
          "properties.status_transition",
        );
      }
    },
  );
});

describe("IT-status-parity: the enquiry machine against guard_enquiries (S6-T05)", () => {
  const admin = adminClient();
  let ownerId: string;
  let listingId: string;
  const madeEnquiries: string[] = [];

  beforeAll(async () => {
    const email = `it-status-parity-enq-${RUN}@example.test`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("Could not create the owner");
    ownerId = created.data.user.id;
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: ownerId,
        short_id: madeUpShortId(),
        slug: `it-status-parity-enq-${randomUUID()}`,
        status: "approved",
        listing_type: "sale",
        property_type: "apartment",
        title: `Home for the enquiry table ${RUN}`,
        description: "A bright flat.",
        price: 8500000,
        area_sqft: 950,
        locality: "Adyar",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600020",
        address: "12 Beach Road",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the listing (${error.code})`);
    listingId = data.id;
  });

  afterAll(async () => {
    if (madeEnquiries.length > 0) await admin.from("enquiries").delete().in("id", madeEnquiries);
    await admin.from("properties").delete().eq("id", listingId);
    await admin.auth.admin.deleteUser(ownerId);
  });

  const pairs = ENQUIRY_STATUSES.flatMap((from) =>
    ENQUIRY_STATUSES.filter((to) => to !== from).map((to) => [from, to] as const),
  );

  it.each(pairs)(
    "%s to %s is allowed by the trigger exactly when the table allows it",
    async (from: EnquiryState, to: EnquiryState) => {
      const inserted = await admin
        .from("enquiries")
        .insert({ property_id: listingId, name: "Arjun Menon", phone: "9841055512", status: from })
        .select("id")
        .single();
      if (inserted.error) throw new Error(`Could not create a ${from} enquiry`);
      madeEnquiries.push(inserted.data.id);
      const { error } = await admin
        .from("enquiries")
        .update({ status: to })
        .eq("id", inserted.data.id);
      if (canTransition("enquiry", from, to)) {
        expect(error, `${from}>${to} should be allowed`).toBeNull();
      } else {
        expect(error?.message, `${from}>${to} should be refused`).toContain(
          "enquiries.status_transition",
        );
      }
    },
  );
});
