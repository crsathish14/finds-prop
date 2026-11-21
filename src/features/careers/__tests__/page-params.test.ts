import { describe, expect, it } from "vitest";
import {
  adminJobsHref,
  jobPath,
  jobsHref,
  parseAdminJobParams,
  parseJobSlug,
  parsePublicJobParams,
} from "../page-params";

/** The parameters of an address as the page receives them. */
const raw = (text: string) => Object.fromEntries(new URLSearchParams(text));

describe("parsePublicJobParams (ADR-143): what /careers reads from the address", () => {
  it("reads the words, the four filters and the page", () => {
    expect(
      parsePublicJobParams(
        raw(
          "q=%20%20site%20engineer%20&department=sales&location=Chennai&mode=remote&type=internship&page=3",
        ),
      ),
    ).toEqual({
      query: "site engineer",
      department: "sales",
      location: "Chennai",
      mode: "remote",
      type: "internship",
      page: 3,
    });
  });

  it("drops what does not fit instead of refusing it", () => {
    expect(
      parsePublicJobParams({
        ...raw(`q=${"x".repeat(300)}&department=Not%20A%20Slug!&mode=sideways&page=-4`),
        type: ["contract", "part_time"],
      }),
    ).toEqual({ query: "", department: "", location: "", mode: "", type: "contract", page: 1 });
    expect(parsePublicJobParams({}).page).toBe(1);
  });
});

describe("jobsHref and jobPath", () => {
  it("leaves out every empty part and page 1", () => {
    expect(jobsHref()).toBe("/careers");
    expect(jobsHref({ page: 1 })).toBe("/careers");
    expect(jobsHref({ query: "site engineer", mode: "remote", page: 2 })).toBe(
      "/careers?q=site+engineer&mode=remote&page=2",
    );
    expect(jobPath("site-engineer")).toBe("/careers/site-engineer");
  });
});

describe("parseAdminJobParams and adminJobsHref", () => {
  const ID = "00000000-0000-4000-a400-000000000001";

  it("reads the tab, the department id, the words and the page, and drops the rest", () => {
    expect(
      parseAdminJobParams(raw(`status=open&department=${ID.toUpperCase()}&q=%20lead%20&page=2`)),
    ).toEqual({ status: "open", department: ID, query: "lead", page: 2 });
    expect(parseAdminJobParams(raw("status=weird&department=x&page=0"))).toEqual({
      status: "all",
      department: "",
      query: "",
      page: 1,
    });
  });

  it("writes an address with the defaults left out", () => {
    expect(adminJobsHref()).toBe("/admin/careers");
    expect(adminJobsHref({ status: "all", page: 1 })).toBe("/admin/careers");
    expect(adminJobsHref({ status: "trash", department: ID, query: "a b", page: 3 })).toBe(
      `/admin/careers?status=trash&department=${ID}&q=a+b&page=3`,
    );
  });
});

describe("parseJobSlug", () => {
  it("accepts lower case words joined by hyphens and nothing else", () => {
    expect(parseJobSlug("site-engineer-2")).toBe("site-engineer-2");
    for (const bad of ["", "a", "Site-Engineer", "site--engineer", "-site", "site_engineer"]) {
      expect(parseJobSlug(bad)).toBeNull();
    }
    expect(parseJobSlug("a".repeat(121))).toBeNull();
  });
});
