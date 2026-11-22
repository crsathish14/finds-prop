/**
 * The made-up cards the sign-in wall draws behind its message (login wall, ADR-171). Nothing here is a real
 * home or project: the facts are invented numbers, the words come from `en.json` (`loginWall.mock`), the
 * pictures are the Design Lab's drawings, and the module imports nothing from the server or the database, so a
 * visitor who is not signed in can never be handed a real record by drawing it. The screen blurs the cards and
 * hides them from screen readers.
 */
export const MOCK_COVERS = [
  "/design-lab/listings/home-a.svg",
  "/design-lab/listings/home-b.svg",
  "/design-lab/listings/home-c.svg",
] as const;

export type MockHome = {
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  rupees: number;
  cover: string;
};

export type MockProject = { bedrooms: readonly number[]; rupees: number; cover: string };

const cover = (index: number) => MOCK_COVERS[index % MOCK_COVERS.length] ?? MOCK_COVERS[0];

/** Six made-up homes for the results page (the first two for the comparison). */
export const MOCK_HOMES: readonly MockHome[] = Array.from({ length: 6 }, (_, index) => ({
  bedrooms: (index % 4) + 1,
  bathrooms: (index % 3) + 1,
  areaSqft: 900 + index * 150,
  rupees: 4_500_000 + index * 1_250_000,
  cover: cover(index),
}));

/** Six made-up projects for the projects page. */
export const MOCK_PROJECTS: readonly MockProject[] = Array.from({ length: 6 }, (_, index) => ({
  bedrooms: [2, 3],
  rupees: 5_200_000 + index * 900_000,
  cover: cover(index),
}));
