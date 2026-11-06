import type { Translate } from "@/lib/format";
import type { LegalKind } from "./types";

/**
 * The name and the search description of each legal page, written out one by one because the messages
 * check does not follow built keys.
 */
export function legalTitle(translate: Translate, kind: LegalKind): string {
  switch (kind) {
    case "privacy":
      return translate("legal.title.privacy");
    case "terms":
      return translate("legal.title.terms");
    case "cookies":
      return translate("legal.title.cookies");
  }
}

export function legalDescription(translate: Translate, kind: LegalKind): string {
  switch (kind) {
    case "privacy":
      return translate("legal.description.privacy");
    case "terms":
      return translate("legal.description.terms");
    case "cookies":
      return translate("legal.description.cookies");
  }
}
