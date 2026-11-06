"use client";

import { EnquiryCard } from "@/components/domain/enquiry-card";
import { useEnquiryForm, type EnquiryConnection } from "./use-enquiry-form.client";

/** The enquiry card beside the details (from 1024 px) for a signed-in visitor, connected to the action. */
export function ConnectedEnquiryCard({ connection }: { connection: EnquiryConnection }) {
  const { card, formKey } = useEnquiryForm(connection);
  return <EnquiryCard key={formKey} {...card} />;
}
