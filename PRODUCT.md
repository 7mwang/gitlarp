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
3. Reduced GitHub API use after the public rate limit was reached. Public mode lists the latest 18 commits in one request. Each work day can load its missing commit details on demand for exact additions and deletions. An optional token loads those details up front. The UI explains rate limits and reset times, and saved activity can appear when refresh fails.
4. Added GitHub profile images for the repository owner and linked commit authors. When GitHub has no avatar, show a generic profile icon. Sample data uses generic icons.
5. Added notes and image uploads to each work day. An uploaded image becomes that day's share-card background; without one, the card uses a locally bundled technology photo selected by local calendar day. The four photos and their license links are in `README.md`.
6. Reworked the product's visual language and copy. The page now uses a warm paper background, a dark pine sidebar, burnt-orange accents, a flat metric strip, square-edged activity panels, and work-log entries with clear dividers. The share image is photo-led, with a cream lower half and a two-column stat grid. Replaced broad motivational copy with text that describes the data or an action.
7. Published the MVP at `github.com/7mwang/gitlarp`. Enter `7mwang/gitlarp` in GitLarp's repository form to view this project's own commits.

## Verification on September 22

`npm run build` passed after the feature and visual changes. Browser checks covered the sample dashboard, narrow phone and desktop layouts, the daily-photo share preview, an uploaded-photo override, and PNG encoding. The page had no horizontal overflow at 320px and showed no browser runtime errors in the final visual check. GitHub's public limit was exhausted in the test environment, so the one-request public path and per-day line loading were checked with mocked GitHub responses rather than a fresh live fetch.

## Capabilities and Constraints

- A repository may be entered as `owner/repo` or as a GitHub repository URL. Only public repositories are supported.
- Public mode makes one GitHub REST API request for the latest 18 commits. Exact line counts require one detail request per unmeasured commit. A token is optional, stays in page memory, and is sent directly to GitHub. Do not persist tokens.
- Commits are grouped by the user's local calendar day. The 12-week graph displays commits in the fetched window; it is not a complete 12-week repository history.
- Notes and photos live in this browser's `localStorage`, keyed by repository and date. Uploads are limited to 2 MB. Repository activity and measured line counts are also cached locally for rate-limit fallback.
- GitHub avatars depend on authors having linked GitHub accounts. The generic profile icon is the fallback for missing or failed images.
- The card is rendered in `src/shareCard.js` at 1080 × 1350. A user's uploaded image always replaces the daily photo. The daily photos are bundled in the app so card creation does not depend on a wallpaper service. The same canvas serves the preview and downloaded PNG.
- The account, sync, and privacy model beyond local browser storage has not been decided.

## Brand Commitments

Treat this as a developer's activity journal with some of Strava's clarity and energy. It should feel like a useful record of a day, not a SaaS analytics template.

- Use the existing palette in `src/style.css`: warm paper `#f4f2ec`, near-white `#fffefa`, dark pine `#202b26`, and burnt orange `#bd5535`. Use orange to mark activity or a primary piece of data, not as an all-over fill.
- DM Sans handles body copy; Manrope handles large headings and numbers. Small uppercase labels can use the system monospace stack. Keep self-hosted fonts.
- Prefer borders, dividers, type size, and spacing to shadows, floating tiles, decorative arrows, or a colored icon for every statistic. The three overview measures form one strip. Work days read as log entries.
- Keep the share card's photo header, visible repo and contributor avatars, cream stats area, and two-column grid. Keep text legible over varied photos. Its bottom section shows the user's note when one exists and commit messages otherwise.
- Use real, properly licensed photography for bundled backgrounds. Avoid synthetic glows, contour lines, mesh gradients, and other stock AI-style decorations. Keep the uploaded-image override intact.
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

- `src/App.jsx`: GitHub loading, grouping, rate-limit handling, local storage, work-log UI, and share dialog.
- `src/shareCard.js`: daily background choice, avatar and photo loading, canvas composition, and PNG download.
- `src/style.css`: palette, typography, layout, states, and responsive rules.
- `src/assets/card-backgrounds/`: the four bundled technology photos.
- `README.md`: setup, feature summary, operating limits, and photo credits.
