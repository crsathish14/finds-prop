# ADR-087 · The project form: its parts in the Design Lab (S7-T02, part B1)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-086 (the server side), ADR-078 (the drawer and tables), ADR-076 (the builder form), FR-ADM-04, FR-BLD-02, BR-41
- Plan approved by the owner on 9 Nov 2026 ("approved all"): a sectioned form with a section list; the Builder and Enquiry form boxes for the admin only; amenities, advantages and nearby places as free-text lists with suggestions; no map picker (latitude and longitude are boxes); the media section and the price trends come in part B2.

## Decision

- **Six new parts, all without state of their own** (the page keeps the values, the errors and the words): `ProjectFields` (the sections Basics, Location, RERA, Details, SEO, and a Media slot that part B2 fills), `ProjectSectionNav` (the section list), `ProjectFormLayout` (the alert, the list, the sections, the admin's side boxes and the save bar), `ProjectSaveBar`, `FormSection` and `TagListField` (the last two are patterns other forms can use).
- **One set of fields for both roles.** The Builder box shows only when the page gives the list of builders, which only the admin's page does; a builder's form is the same parts without it, and the page address is read-only for a builder once the project is approved (the database enforces it too, ADR-086). The Enquiry form and Price trends boxes are the admin's side boxes in the layout's `aside`; a builder's form has none.
- **Numbers are typed as text.** Prices, land area, units, latitude and longitude are plain boxes with the right keypad (`inputMode`); the server reads "78,00,000" and refuses what is not a number, so the form needs no number parsing of its own. An empty box is "not set".
- **Free-text lists.** `TagListField` adds a phrase on Enter, a comma or the Add button, tidies the spaces, ignores an empty or repeated phrase (any capitals), cuts a phrase to 80 characters, and stops at the list's limit (advantages 20, nearby places 20, amenities 30; the same limits as the server). Suggestions are one-tap chips and leave once added.
- **Section list.** One link to each section by its anchor, a row that scrolls sideways below 1100 px of screen and a column beside the form from there. The current section and each section's state (done, needs attention) are given by the page; a state is shown by an icon and said in words, not by colour alone.
- **Possession is the browser's date picker,** because the database holds a date; the UX file shows free text ("Dec 2028"), which the server could not store as a date.
- **BHK options** offer 1 to 5; a project that already has another count (0 to 10 is valid) shows it as well, so opening and saving never loses it.
- **The RERA switch** turns the number box off, and the server drops a number when RERA does not apply (ADR-086), so a leftover box never blocks a save.
- **Not in this change:** the media section and the price trends (part B2), the connected pages (part C), and the section list following the scroll (the page does that).

## Wording to confirm

- "Not set" (the empty first choice of Project type, Property type, Status and Builder)
- "Add", "Remove" (said before the phrase on each x: "Remove: Clubhouse") and "Suggestions" (the tag list)
- "The list is full." (a list at its limit)
- "Form sections" (the section list's name), "Complete" and "Needs attention" (said for a screen reader beside a section)
- "Page address: /projects/" before the slug (the UX file shows "Page address: /projects/kadal-vista")
- "3 things need attention" with a line naming them (the UX file shows "2 things need attention")
- "Saving sends this project for approval" and "It is set to Pending and hidden from the public site until it is approved again" are the UX file's own words and are marked "Confirm this rule" there; they are built as written.

## Consequences

- Components and a Design Lab entry only: three entries on the Admin board (Project form, Project section list, Tag list field). No server, database, package, gate or environment change.
- The Admin board's three Linux baselines (390, 820, 1440) are not in this change yet: the owner approves the CI pictures first and the baselines go in their own commit.
- Rollback: delete the parts, their tests and their Lab entries. Nothing else uses them yet.
