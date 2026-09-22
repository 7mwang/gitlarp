# GitLarp

A React + Vite MVP that turns recent GitHub repository commits into a progress log.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The app opens in sample mode. Connect a public repository by entering `owner/repo` or its GitHub URL.

## What it does

- Fetches the latest 18 commits with one GitHub REST API request in public mode. Each work card can load exact additions/deletions for its commits on demand. An optional token fetches all line counts upfront.
- Groups commits by local calendar day into work cards.
- Shows summary totals and a 12-week activity graph.
- Saves notes and photos in this browser's `localStorage`, scoped by repository and day. Photos must be under 2 MB.
- Shows the repository owner's avatar and the contributors for each work day. The shareable 1080 × 1350 PNG uses a two-column stats grid with their GitHub avatars and an optional note. Its technology photo changes each local calendar day; an uploaded photo replaces it.

The four bundled card photos are by [Kevin Ache](https://unsplash.com/photos/a-rack-of-servers-in-a-server-room-2JJ3wBHu4_0), [Alexandre Debiève](https://unsplash.com/photos/macro-photography-of-black-circuit-board-FO7JIlwjOtU), [Alexandr Popadin](https://unsplash.com/photos/two-large-satellite-dishes-against-a-dark-sky-HAZXznKGtuI), and [Liam Briese](https://unsplash.com/photos/macro-shot-photo-of-a-computer-ram-lYxQ5F9xBDM), used under the [Unsplash License](https://unsplash.com/license).

This client-only MVP supports public repositories. GitHub's unauthenticated API limit still applies, but public mode now uses one request per load. If the limit is already exhausted, use a GitHub token or wait for its reset. Tokens are kept in page memory only and are sent directly to GitHub. Successful activity is cached in this browser for a fallback when the limit is exhausted. The 12-week graph reflects the fetched commits, so it is a recent-commit view rather than complete repository history.
