# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 and Vite 7, plain CSS, Phosphor icons, self-hosted DM Sans and Manrope variable fonts. The share image is drawn with the browser canvas API. There is no backend, account system, or database.

## Users

GitHub contributors who want a personal record of what they built in a repository and a clear image they can share.

## Product Purpose

GitLarp is a Strava-like work log for GitHub. It turns recent commits in one public repository into dated work entries with commit and line counts, contributor identities, an activity graph, optional notes and photos, and an image people can share.

GitHub activity supplies the facts. A note or photo supplies context that commit messages may miss. Never imply that GitLarp measured time spent coding or captured a repository's complete history.

## What we built on September 22, 2026

1. Started the React + Vite MVP with a sample workspace, repository connection form, summary metrics, 12-week heatmap, and a work log grouped by local calendar day.
2. Added shareable 1080 × 1350 PNG cards. They show the repository, date, work-day title, contributor avatars, a two-column grid of commits and line stats, and a note or commit log.
3. Reduced GitHub API use after the public rate limit was reached. Public mode originally listed the latest 18 commits in one request. Each work day could load its missing commit details on demand for exact additions and deletions. The UI explains rate limits and reset times, and saved activity can appear when refresh fails.
4. Added GitHub profile images for the repository owner and linked commit authors. When GitHub has no avatar, show a generic profile icon. Sample data uses generic icons.
5. Added notes and image uploads to each work day. An uploaded image becomes that day's share-card background; without one, the card uses a locally bundled technology photo selected by local calendar day. The four photos and their license links are in `README.md`.
6. Reworked the product's visual language and copy. The page now uses a warm paper background, a dark pine sidebar, burnt-orange accents, a flat metric strip, square-edged activity panels, and work-log entries with clear dividers. The share image is photo-led, with a cream lower half and a two-column stat grid. Replaced broad motivational copy with text that describes the data or an action.
7. Published the MVP at `github.com/7mwang/gitlarp`. Enter `7mwang/gitlarp` in GitLarp's repository form to view this project's own commits.
8. Expanded the default-branch activity window to 12 weeks. The first request loads up to 100 commits; the user can load older pages one request at a time. Partial history is labeled. A contributor filter narrows the totals, graph, work log, and card to one author. Line details still load on demand, including with a token, so the first page does not cause up to 100 detail requests.

## Verification on September 22

`npm run build` passed after the feature and visual changes. Browser checks covered the sample dashboard, narrow phone and desktop layouts, the daily-photo share preview, an uploaded-photo override, and PNG encoding. The page had no horizontal overflow at 320px and showed no browser runtime errors in the final visual check. GitHub's public limit was exhausted in the test environment, so the one-request public path and per-day line loading were checked with mocked GitHub responses rather than a fresh live fetch.

The 12-week pagination and contributor filter were checked with mocked GitHub responses in a local browser. A second page updated the card list, totals, and complete-history label; filtering to its author showed only that commit. Loading lines for one author on a shared day kept the other author's commit in the team view. The 375px layout had no page overflow. Both normal and Pages builds passed.

## September 24, 2026: card studio

Share cards now request a daily image from the public Wikimedia Commons API, using the featured NASA image category. The selection changes with the viewer's local calendar day, and the live category can gain new files over time. Only raster images whose Commons metadata says public domain or CC0 are eligible. The card credits Commons and the preview links to the file page and states the license. The chosen image metadata is cached for the day; an uploaded photo takes priority, and bundled photos remain the fallback when the API or image fails.

The card now includes a commit chart. A single-day card shows the seven days ending on that date. A multi-day card shows the full span between the earliest and latest selected dates, including unselected days for context; long spans are grouped into up to 28 bars. The selected dates use the chosen accent color. Counts reflect loaded, currently filtered activity.

The card studio centralizes creation. Start from the dashboard or a work day, name the card, select loaded dates, choose the automatic daily or saved photo or upload one just for this card, and set the chart accent. The preview redraws as settings change. Multi-day cards sum known line counts and commit counts, merge notes, and use the latest selected work-day photo in automatic mode. If any selected day's lines are not measured, the combined line counts remain unavailable. Card-only uploads are not written to local storage. The PNG file name includes the card title.

The normal and GitHub Pages builds passed. Browser checks used sample data at desktop and 375px widths, covered a live Commons image, multi-day totals and chart, an uploaded-photo override, and PNG encoding. `node tests/cardData.test.js` passed both aggregation checks. The real GitHub API path was not exercised in these card-focused checks.

The share image was later tuned for feed-size reading: larger title, repository and contributor identities, stronger primary stats, a pale chart band with taller bars, and a commit area with two distinct recent messages. The commit label states how many additional messages are omitted; a user's note still takes that area when present. Keep the chart's canvas text alignment from leaking into the log and footer, or left-edge text will clip. Maintain clear space between the commit heading, each message row, and the footer.

## Capabilities and Constraints

- A repository may be entered as `owner/repo` or as a GitHub repository URL. Only public repositories are supported.
- Public mode makes one GitHub REST API request for up to 100 default-branch commits in the last 12 weeks. Each older page costs another request. Exact line counts require one detail request per unmeasured commit. Each visitor may supply their own optional, fine-grained token with `Contents: read-only`. It stays in page memory, is sent directly to GitHub, and can be forgotten from the connection dialog. Never persist a token in cookies, `localStorage`, a URL, or the repository.
- Commits are grouped by the user's local calendar day. The 12-week graph and totals show loaded commits; they are complete for the default branch only when all pages have loaded. The contributor filter is based on the commit author returned by GitHub, which may be a name when no GitHub account is linked.
- Notes and photos live in this browser's `localStorage`, keyed by repository and date. Uploads are limited to 2 MB. Repository activity and measured line counts are also cached locally for rate-limit fallback.
- GitHub avatars depend on authors having linked GitHub accounts. The generic profile icon is the fallback for missing or failed images.
- The card is rendered in `src/shareCard.js` at 1080 × 1350. A selected uploaded image replaces the API-selected daily photo. The four bundled photos remain as a fallback so card creation does not depend on Commons being available. `src/dailyImage.js` handles source selection, license checks, and day-scoped metadata caching. `src/cardData.js` combines selected days. The same canvas serves the preview and downloaded PNG.
- The account, sync, and privacy model beyond local browser storage has not been decided.

GitHub Pages needs a build with `/gitlarp/` as the Vite base path (`npm run build:pages`). Pages can serve the current static app but cannot provide an HttpOnly session cookie or a server-side GitHub OAuth exchange. Do not call the memory-only token flow equivalent to server-managed sign-in. If GitLarp needs one-click GitHub authorization later, use a GitHub App with a backend and a secure session design. Do not add a shared owner token to the client bundle.

## Brand Commitments

Treat this as a developer's activity journal with some of Strava's clarity and energy. It should feel like a useful record of a day, not a SaaS analytics template.

- Use the existing palette in `src/style.css`: warm paper `#f4f2ec`, near-white `#fffefa`, dark pine `#202b26`, and burnt orange `#bd5535`. Use orange to mark activity or a primary piece of data, not as an all-over fill.
- DM Sans handles body copy; Manrope handles large headings and numbers. Small uppercase labels can use the system monospace stack. Keep self-hosted fonts.
- Prefer borders, dividers, type size, and spacing to shadows, floating tiles, decorative arrows, or a colored icon for every statistic. The three overview measures form one strip. Work days read as log entries.
- Keep the share card's photo header, visible repo and contributor avatars, cream stats area, two-column grid, and commit chart. Keep text legible over varied photos. Its bottom section shows the user's note when one exists and commit messages otherwise.
- Use real, properly licensed photography for bundled backgrounds. Avoid synthetic glows, contour lines, mesh gradients, and other stock AI-style decorations. Keep the uploaded-image override intact.
- Preserve source and license information for API images in the preview and export. A remote image must load with CORS before it is drawn into the canvas, or PNG export will fail. Do not use Bing wallpaper or APOD images without checking redistribution rights and canvas access.
- Design for desktop and narrow phones. The current layout changes at 1050px, 760px, and 390px; a 320px viewport has no horizontal page overflow. Preserve visible keyboard focus, reduced-motion support, and readable contrast for small labels.

## Copy and commenting style

- Write UI copy that names the data, state, or next action: “Lines changed,” “Load line counts,” “Add note,” “Make share card.” Say when counts are unavailable. Avoid vague claims about journeys, milestones, effortless work, or work “moving forward.”
- Use short sentences and active voice. Remove filler, rhetorical setups, formulaic contrasts, and motivational taglines. A commit title can be rough; do not rewrite user or GitHub content to sound polished.
- Match the code already here: functional React components, small helper functions, single quotes, two-space indentation, no semicolons, and plain CSS. Keep GitHub fetching and grouping separate from presentation where practical. Keep canvas drawing helpers small and focused.
- Comments should explain a non-obvious reason or constraint, such as API request economy, cache behavior, date grouping, CORS on canvas images, or a layout calculation. Do not comment on what a straightforward line already says. Keep comments brief and update or remove them when behavior changes.
- Preserve `README.md` as the run and feature guide. Use this file for product decisions and future-agent guidance; do not make it a second copy of every implementation detail.

## Commit convention

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) for every commit: `type(optional-scope): short description`. Use `feat:` for a new feature, `fix:` for a bug fix, `docs:` for documentation, and other clear types such as `refactor:`, `test:`, or `chore:` when they fit. Mark a breaking change with `!` after the type or scope, or with a `BREAKING CHANGE:` footer. Add a body when the reason for a change is not clear from the subject.

Keep future commits focused so GitLarp's own work log has useful entries. Do not invent separate historical steps for work already completed. Avoid rewriting published `main` except when the user explicitly asks.

## Skills and review workflow for future agents

These skills were already available in the September 22 environment and were applied to the redesign; install them only if a future environment lacks them:

- `design-taste-frontend`: infer a visual direction before a redesign. Use its anti-template guidance for the overall visual language; GitLarp's dashboard details need more specific product UI guidance.
- `ui-ux-pro-max`: use for dashboard layout, mobile behavior, accessibility, typography, and contrast. Check a recommendation against GitLarp's actual product before adopting it.
- `stop-slop`: review new UI copy and prose for generic AI wording.
- `impeccable`: use when auditing or polishing interface consistency and edge cases.
- `agent-browser`: inspect real desktop and mobile renders, the share preview, and the exported canvas after visual changes.

The user's global `AGENTS.md` instruction also names a `caveman` skill at `~/.agents/skills/caveman/SKILL.md`. That file was not present in this workspace on September 22. Check for it in a future environment and apply it if available; do not invent its contents.

For visual changes, read this file and the relevant code, inspect the existing page, then make one coherent pass across UI and copy. Run `npm run build` and check the browser at desktop and phone widths. When changing `src/shareCard.js`, preview both a daily-photo card and a card with an uploaded image, and confirm the canvas can export a PNG. Use sample data or mocked GitHub responses for routine visual QA so tests do not consume the public API limit.

## Main files

- `src/App.jsx`: GitHub loading, grouping, rate-limit handling, local storage, work-log UI, and card studio.
- `src/shareCard.js`: daily background choice, avatar and photo loading, canvas composition, and PNG download.
- `src/dailyImage.js`: Commons category lookup, public-domain/CC0 selection, and day-scoped image metadata cache.
- `src/cardData.js`: multi-day card aggregation and saved-photo choice.
- `src/style.css`: palette, typography, layout, states, and responsive rules.
- `src/assets/card-backgrounds/`: the four bundled technology photos.
- `README.md`: setup, feature summary, operating limits, and photo credits.
