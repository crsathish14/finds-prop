"use client";

import { useState } from "react";
import { HomeSearchBar, type HomeSearchBarProps } from "@/components/domain/home-search-bar.client";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

type HostProps = Partial<Omit<HomeSearchBarProps, "action">>;

/** The home page's search bar as the page draws it while AI search is on; pressing the button goes nowhere here. */
export function HomeSearchBarHost({ mode = "ai", onSearch, ...rest }: HostProps) {
  return (
    <HomeSearchBar
      mode={mode}
      action="#search"
      maxLength={1000}
      {...rest}
      onSearch={onSearch ?? (() => undefined)}
    />
  );
}

const FRAME = "w-full max-w-(--w-search-card)";

export function HomeSearchBarDemo() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="AI search on: one box and the Search with AI button (the button sits under the box below 576 px of bar width)">
        <div className={FRAME}>
          <HomeSearchBarHost onSearch={setLast} />
        </div>
        <Text variant="caption" tone="muted">
          {last === null
            ? "Press Search with AI to see the words it hands to the chat."
            : `Search with AI pressed with: ${JSON.stringify(last)}`}
        </Text>
      </Specimen>
      <Specimen label="Filled: the words stay on one line and are cut at the end of the box">
        <div className="w-full max-w-2xl">
          <HomeSearchBarHost defaultValue="A 3 BHK apartment near Velachery or Adyar, under ₹90 lakh, ready to move in, close to a school" />
        </div>
      </Specimen>
      <Specimen label="AI search off: the keyword search of the results page">
        <div className={FRAME}>
          <HomeSearchBarHost mode="keyword" />
        </div>
      </Specimen>
      <Text tone="muted">
        Hover and keyboard focus draw a ring around the box. On the site, Search with AI opens the
        chat and sends the words as its first message; an empty box opens the chat with the cursor
        in it. The keyword search goes to the results page.
      </Text>
    </div>
  );
}
