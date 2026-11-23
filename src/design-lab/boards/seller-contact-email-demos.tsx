"use client";

import { useState, type FormEvent } from "react";
import { ContactEmailCard } from "@/components/domain/contact-email-card";
import { Specimen } from "../frame";

const FRAME = "w-full max-w-4xl rounded-xl border border-line bg-canvas p-4";
const NOTHING = () => undefined;
const KEEP = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

/** The card on the dashboard where an owner adds or changes the email enquiries are mailed to (ADR-184). */
export function ContactEmailCardDemo() {
  const [email, setEmail] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  return (
    <div className="flex w-full flex-col gap-8">
      <Specimen label="Try it: no address yet, save one, change it, cancel">
        <div className={FRAME}>
          <ContactEmailCard
            email={email}
            editing={editing}
            value={value}
            onValueChange={setValue}
            onSubmit={(event) => {
              event.preventDefault();
              if (value.trim() === "") return;
              setEmail(value.trim().toLowerCase());
              setEditing(false);
              setValue("");
            }}
            onChange={() => {
              setValue(email ?? "");
              setEditing(true);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </Specimen>
      <Specimen label="No address yet: the prompt for an owner who has homes">
        <div className={FRAME}>
          <ContactEmailCard
            email={null}
            value=""
            onValueChange={NOTHING}
            onSubmit={KEEP}
            onChange={NOTHING}
            onCancel={NOTHING}
          />
        </div>
      </Specimen>
      <Specimen label="Something typed that is not an address">
        <div className={FRAME}>
          <ContactEmailCard
            email={null}
            value="priya.raman@"
            error="Enter a valid email address, like name@example.com."
            onValueChange={NOTHING}
            onSubmit={KEEP}
            onChange={NOTHING}
            onCancel={NOTHING}
          />
        </div>
      </Specimen>
      <Specimen label="Saving">
        <div className={FRAME}>
          <ContactEmailCard
            email={null}
            value="priya.raman@example.com"
            busy
            onValueChange={NOTHING}
            onSubmit={KEEP}
            onChange={NOTHING}
            onCancel={NOTHING}
          />
        </div>
      </Specimen>
      <Specimen label="The save did not get through">
        <div className={FRAME}>
          <ContactEmailCard
            email={null}
            value="priya.raman@example.com"
            failure="We couldn't save your email. Check your connection and try again."
            onValueChange={NOTHING}
            onSubmit={KEEP}
            onChange={NOTHING}
            onCancel={NOTHING}
          />
        </div>
      </Specimen>
      <Specimen label="Saved: the address with Change">
        <div className={FRAME}>
          <ContactEmailCard
            email="priya.raman@example.com"
            value=""
            onValueChange={NOTHING}
            onSubmit={KEEP}
            onChange={NOTHING}
            onCancel={NOTHING}
          />
        </div>
      </Specimen>
      <Specimen label="Saved: a very long address wraps">
        <div className={FRAME}>
          <ContactEmailCard
            email="priya.raman.chennai.homes.and.plots.enquiries@example-property-company.co.in"
            value=""
            onValueChange={NOTHING}
            onSubmit={KEEP}
            onChange={NOTHING}
            onCancel={NOTHING}
          />
        </div>
      </Specimen>
      <Specimen label="Changing a saved address">
        <div className={FRAME}>
          <ContactEmailCard
            email="priya.raman@example.com"
            editing
            value="priya.raman@example.com"
            onValueChange={NOTHING}
            onSubmit={KEEP}
            onChange={NOTHING}
            onCancel={NOTHING}
          />
        </div>
      </Specimen>
    </div>
  );
}
