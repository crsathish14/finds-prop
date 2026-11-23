# ADR-173 · Blog Markdown paste: an AI prompt, an Add link button and places for pictures

- Status: Accepted (the owner asked on 23 Nov 2026 for a prompt that turns an article written with any AI tool into the Markdown the site accepts, and for links and pictures to be attachable; the four decisions below were answered by the owner; the draft wording waits for approval).
- Date: 2026-11-23
- Amends: ADR-172 (the paste flow: a picture is no longer turned into words; the converter and the draft action take pictures)
- Related: ADR-144 (the block format and the picture rules), ADR-169 (inline links), R-SEC-10 (never draw user text as HTML)
- Class: C2 (a changed server action). No migration, no dependency, no new table, column, type or bucket.

## Context

People bring an article already written with an AI tool. ADR-172's paste flow reads Markdown, but an AI tool does not know which Markdown this site keeps, so the first paste often loses structure (bold, tables, nested lists, links in headings, a picture's address). A picture in the pasted text was turned into its description as words, so every picture had to be found again in the block editor after the draft was made. Links worked, but only by typing `[words](address)` by hand.

## Decision

The owner answered four questions, which fix the scope:

1. **A picture is a place in the text.** The owner chose "a picture at that spot", not "a word that opens a picture". No new article format, so no migration.
2. **Pictures are chosen on the paste screen, before the draft is made.**
3. **Links: the prompt keeps them, and the paste box has an Add link button.**
4. **Super admins only**, as today (no permission change).

What was built:

- **A prompt for any AI tool** (`src/features/blog/markdown/ai-prompt.ts`, `buildAiPrompt`). The paste screen has a "Copy the AI prompt" button (and the prompt can be shown and selected, in case the browser refuses to copy). The writer pastes the prompt into the AI tool with their article under it and pastes the answer back. The prompt is English text for a machine, so it is code and not a translated message. **Every limit in it is read from the same constants the converter and the database use**, and a test converts the prompt's own example with no change or problem reported and checks the blocks against the article schema, so the prompt cannot drift from the rules. It asks for: one code block and nothing else; the author's words unchanged; one `# Title`, `##` and `###` only; paragraphs, `-` and `1.` lists (never nested), `>` quotes with a `> — Name` credit; **no** tables, code, HTML, bold, italic or rules; every link kept on its same words as `[words](https://…)` or `[words](/page)`, with no other kind of address and no link in a heading; and each picture as a line of its own, `![what it shows](IMAGE-1)`, numbered in order, never a real address.
- **A place for a picture** (`convertMarkdown`). A line that is only `![what it shows](IMAGE-n)` is a place. The converter reports every place (`slots`: name, description, line) and, when it is given a chosen picture for a place, an `image` block there. A place with no picture is left out of the draft with a note naming it. A picture line with **any other address** (a real image URL an AI tool wrote anyway) becomes the next free place with a note: **the address is never fetched** (no server or browser reads a picture from the internet, so there is no request to an address a writer pasted). A second line that reuses a name is removed with a note. A picture inside a sentence is still turned into its description as words (a picture is a block, not part of a sentence).
- **Choosing the files.** The paste screen lists each place with a file chooser and a "what it shows" box (filled from the text, required once a file is chosen). The same file rules as the block editor apply at once (JPG, PNG or WEBP, 500 KB), and the chosen file is drawn in the live preview at its place. The files wait in the browser.
- **Making the draft.** A picture's folder is `blog/<article id>/`, so the browser **chooses the article's id first** (`crypto.randomUUID()`), sends each file to that folder with the signed-in admin's own session (the bucket's policy already lets only the super admin write), and then calls the same `createBlogPostFromMarkdown` action with the id and the list of `{ place, path, description }`. The action converts the text again with those pictures, refuses a picture for a place the text does not have (or two for one place), checks the blocks with the article schema, **reads every file back from the bucket and checks its type, weight, size and folder before anything is made** (so a refused picture leaves no draft behind), and then makes the draft with that id and saves it with the same two steps as before. If anything fails, the browser takes the files it sent away again. A file that is left by a closed tab is an orphan under an id with no article, which the existing orphan listing (`orphan_blog_files`, ADR-146) already reports and the nightly retention removes.
- **An Add link button in the paste box**, the block editor's own form (`BlogLinkTextField`, ADR-169): select words (or put the cursor), press the button, type the address, and `[words](address)` is put in place, checked with the same rules. `BlogLinkTextField` takes the button's name and the box's own look as properties so the paste box does not pretend to be "block 1".

## Alternatives not taken

- **A word that opens a picture** (an image attached to a word, like a link): a new inline format, a new migration for the body check and a new viewer. Not chosen; the owner picked "a picture at that spot".
- **Uploading in the block editor after the draft is made** (the smaller change): not chosen; the owner asked for upload on the paste screen. Pictures that were not chosen can still be added in the editor.
- **Creating the draft first, then uploading and saving a second time**: two server calls and a half-made draft when the second fails. The browser-chosen id makes it one call and lets the server check every file before it makes anything.
- **Fetching a picture from its address** in the pasted text: a request to an address a writer typed (a server-side request to anywhere) and a copyright question. Never done; the writer chooses the file.
- **Sending the prompt through the site's own AI assistant** (the converter running on our model): costs money per article and ties the paste flow to the assistant's availability and its rules about what it may write. The writer uses the tool they already have.

## Consequences

- Admins can bring in an article from any AI tool with its structure, links and picture places intact, and the pictures are attached before the draft opens.
- A picture from the old blog must be a file the admin has (a download), at most 500 KB.
- The pasted text's real picture addresses are never used; they only help the admin recognise which picture goes where (the note shows the address).
- The paste flow's files grow by one file (`ai-prompt.ts`); removing the flow (ADR-172) still means deleting the same folder and the chooser's second card.
- Wording under `admin.blog.markdown.ai`, `.pictures`, `.paste.addLink`, `.paste.linkGroup`, `.syntax.pictures` and `.warning.image*` in `en.json` is **draft** and is flagged in the PR for approval.
