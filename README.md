# GitLarp

A React + Vite MVP that turns recent GitHub repository commits into a progress log.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The app opens in sample mode. Connect a public repository by entering `owner/repo` or its GitHub URL.

## GitHub Pages build

Run `npm run build:pages` to build for `https://7mwang.github.io/gitlarp/`. Publish the resulting `dist/` folder with a GitHub Pages Actions workflow. The normal `npm run build` keeps root-relative assets for other hosts. GitHub Pages is static hosting, so it cannot run a token exchange or set an HttpOnly session cookie.

## What it does

- Fetches up to 100 default-branch commits from the last 12 weeks in one GitHub REST API request. A control loads the next page when more history exists. Each work card can load exact additions/deletions for its commits on demand.
- Groups commits by local calendar day into work cards.
- Shows summary totals and a 12-week activity graph. A contributor filter updates the totals, graph, work log, and share cards to show that author's commits.
- Saves notes and photos in this browser's `localStorage`, scoped by repository and day. Photos must be under 2 MB.
- Shows the repository owner's avatar and the contributors for each work day. The shareable 1080 × 1350 PNG uses a two-column stats grid with their GitHub avatars and an optional note. Its technology photo changes each local calendar day; an uploaded photo replaces it.

The four bundled card photos are by [Kevin Ache](https://unsplash.com/photos/a-rack-of-servers-in-a-server-room-2JJ3wBHu4_0), [Alexandre Debiève](https://unsplash.com/photos/macro-photography-of-black-circuit-board-FO7JIlwjOtU), [Alexandr Popadin](https://unsplash.com/photos/two-large-satellite-dishes-against-a-dark-sky-HAZXznKGtuI), and [Liam Briese](https://unsplash.com/photos/macro-shot-photo-of-a-computer-ram-lYxQ5F9xBDM), used under the [Unsplash License](https://unsplash.com/license).

This client-only MVP supports public repositories. GitHub's unauthenticated API limit still applies. Each page of history costs one request, and line counts cost one request per commit measured. If the limit is already exhausted, each visitor can use their own fine-grained, read-only GitHub token or wait for the limit to reset. GitLarp keeps a supplied token in this tab's memory only, sends it directly to GitHub, and offers a **Forget token** control. A refresh or tab close clears it. GitLarp does not save tokens in cookies or `localStorage`; its local cache contains repository activity, notes, and photos. The graph labels partial history until all available pages in the 12-week default-branch window are loaded.
