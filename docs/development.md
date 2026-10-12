# Development and architecture

[Project overview](../README.md) · [Product decisions](../DECISIONS.md)

## Run

Requires Node.js 22 or newer. No dependencies or installation step are needed.

```sh
git clone https://github.com/provatidis/passiko.git
cd passiko
npm start
```

For an existing clone, pull the latest `main` and run `npm start` from its checkout directory. No installation step is needed.

The HTTP server defaults to loopback port 3000. Set `HOST` and `PORT` to change its binding. It serves only the `public/` directory. To verify it:

```sh
curl --fail http://127.0.0.1:3000/
```

Open http://127.0.0.1:3000/ in your browser. The hypothetical labs, lessons and bundled recorded cases work without an external network connection. Live snapshots and the development-only chain verifiers need RPC access. No wallet, API key or locally running blockchain node is required.

## Test

```sh
npm test
```

Tests cover the sandbox and both hypothetical models, versioned links and exports, v2/v3 snapshot validation, exact v3 fee accounting, fixed-position period accounting and continuity evidence, learning assessments, saved comparisons, Learn-return drafts and storage failures. The bundled historical records are checked locally without RPC calls; `npm run check:replay` separately recaptures and verifies chain history through public providers.

For a local browser smoke test, install Chromium or set `CHROMIUM_BIN` to its executable, then run `npm run test:browser`. It starts temporary servers and checks actual page interactions at desktop and mobile sizes, including calculators, learning, snapshot imports, saved comparisons, the historical checkpoint slider, downloads and persistence. Navigation checks cover sticky-header offsets, direct tool fragments, browser history and returning from Learn. The same suite runs in CI before deployment. The test runner launches Chromium with its browser sandbox disabled; serving the app itself requires no browser installation.

Set `TEST_BASE_URL` to a deployed site or a local server with a project subpath to test that target instead of starting the Node server. The browser smoke test checks that the home link, scripts, styles, and swaps work at that base URL.

## Focused workspaces and historical records

`public/ui/workspaces.js` controls visibility and top-level navigation without rebuilding feature controllers. `public/lib/workspace-links.js` maps existing fragments to Experiment, Inspect or Pool mechanics; `#historical-case` opens the recorded replay. Lab and snapshot controllers receive an activation callback from `main.js`, so explicit handoffs reveal the correct workspace while preserving drafts. Learn remains a separate document. Primary fragments `#experiment` and `#inspect` open section introductions; existing tool fragments still open their targets. `page-access.js` measures the sticky header for native anchor offsets, lab tabs and the learning sidebar.

The period model lives in `public/models/fixed-position-period.js`; record validation is in `public/data/position-period.js`; values for display are in `public/lib/period-presentation.js`; the DOM controller is in `public/ui/position-period.js`. The development-only `scripts/check-replay.js` captures and independently checks a bounded fixed-position period, with an optional 2–32 checkpoint count. It validates the complete record before writing it. `public/data/replay-cases.js` orders the bundled cases and preserves the original fragment while adding `#historical-case=range-return`. Case selection keeps separate checkpoint positions in the current document; late responses cannot replace a newer selection. Interval presentation uses cumulative credit differences and cumulative range-time counters. See [the replay method](replay.md).

## Project structure

- public/main.js and public/learn-main.js: composition roots for Experiment/Inspect and Learn respectively. They initialize each document's controllers and inject the interfaces they need.
- public/ui/: explicit initializers for the sandbox, both labs, learning, pool/position snapshots, saved experiments, historical replay and navigation. Importing a controller does not start it.
- public/models/: pure hypothetical calculations, lesson experiments and exact protocol/period arithmetic. They do not read the DOM, browser storage or network.
- public/data/: deployment configuration, read-only Uniswap v2/v3 adapters, snapshot/period schemas, saved experiments, learning progress and temporary Learn-return storage.
- public/lib/: compatible scenario links, exports, formatting and rendering utilities.
- public/learning/: lesson definitions, optional deeper reading and the ten-example progression.
- public/examples/: bundled pool/position snapshots and the verified fixed-position period record; these open without RPC requests.
- public/styles/: shared foundation and components followed by feature styles. public/styles.css preserves the existing cascade order.
- public/index.html and public/learn.html: semantic, static markup with one module entry point per document. Each feature owns its IDs; the structure check rejects duplicates.
- scripts/: development, integration and browser checks; test/: reference calculations and adapter/storage contracts.
- server.js: a local static server; GitHub Pages deploys public/ directly.

Run npm run check to verify module paths, circular dependencies, architectural boundaries, stylesheet imports, unique HTML IDs and document entry points. CI runs this before calculation and browser tests. Existing scenario.js, amm.js and storage.js exports and storage keys remain compatible.

The structure review keeps the current dependency-free deployment. Explicit startup removes cross-controller import side effects; feature styles reduce collisions as labs grow. Shared tab behavior handles keyboard navigation consistently across the sandbox, labs and snapshot sources. ABI decoding, block pinning and snapshot-file/storage handling are shared by both protocol adapters; protocol identity checks remain adapter-specific. Static HTML remains appropriate at this size. Split markup or add a build step when repeated page layouts actually need it. A framework, database or application backend is not needed for read-only, public-chain imports.

## Architecture and extension policy

The static app remains dependency-free and deployable on GitHub Pages. Keep the model, data, utility and UI responsibilities above separate. `public/scenario.js` retains compatibility exports for existing integrations and tests.

New financial models get their own versioned module and reference/invariant tests. New protocols get a deployment definition, adapter, exact token-unit handling and contract validation. Preserve old model links and storage keys; introduce explicit migrations when schemas change. Unit and desktop/mobile browser tests run before deployment.

Release 1.8.0 shipped the first verified fixed-position period: nine checkpoints over 4,992 seconds for position #1382030 in Ethereum's WETH/USDC 0.3% pool. Release 1.9.0 adds a 17-checkpoint exit-and-return case spanning 120,468 seconds for position #1375047 in the same pool. The next validation case is a comparison of existing ranges in the 0.05% pool. Editable historical bounds/windows and arbitrary-range backtesting remain future work; they require evidence beyond sampled prices and global fee growth. See [replay.md](replay.md#next-validation-cases) before extending the model.

A backend becomes useful for private provider credentials, shared caching, scheduled snapshots or account synchronization. Each can be added behind the data layer without rewriting the calculation models or existing labs. No scheduled collector or backend is part of the shipped replay.

The cl-range-v1 model, links, CSV, presentation helpers and result cards are separate modules. A shared link router and accessible lab navigation coordinate the two calculators while preserving cp50-v1 links. Reference tests cover asymmetric funding, outside starts, exact boundaries, continuity, virtual-reserve conservation, wide-range limits, separate fees, numerical bounds and reproducible exports.

## Browser identity and sharing

The open-frame p is supplied as an SVG favicon and a 16/32/48-pixel ICO fallback. Opaque 180-pixel Apple touch and 192/512-pixel maskable app icons with inset artwork accompany a manifest scoped to the project directory. The outlined lowercase wordmark in `public/assets/passiko-logo.svg` is shared by all page headers and exported result cards, with no font download. Forest green, soft sage and warm paper define the identity. The manifest supplies home-screen identity; the app continues to read live chain data only when requested.

Canonical, Open Graph and large-image social-card metadata use the published Pages URL. The 1200×630 preview is a committed PNG generated from an editable SVG. Its chart illustrates the default cl-range-v1 scenario before fees. Scenario fragments share the same site preview. A branded 404 page keeps its links inside /passiko/, while a skip link and JavaScript-disabled notice provide clear entry points. The active skip link preserves shared scenario fragments when moving keyboard focus to the main content.

The structure check verifies linked files, metadata, PNG/ICO dimensions and manifest paths. The local server supplies correct image/manifest types and also serves /passiko/ to mirror Pages links; missing resources keep HTTP status 404.

To regenerate the committed raster assets after editing the SVG sources, run node scripts/render-brand-assets.js in an environment with the optional Sharp graphics tool. SHARP_MODULE can point to its module entry file when Sharp is supplied externally. This is a maintainer-only tool, not a website dependency or required build step.

## Online preview with GitHub Pages

The workflow in `.github/workflows/pages.yml` tests the project and publishes only `public/` whenever `main` changes. It also runs tests on pull requests without publishing them. No hosting credentials or backend server are needed.

Enable it once in the repository's **Settings → Pages → Build and deployment → Source → GitHub Actions**. If the first workflow run happened before Pages was enabled, open **Actions → Test and publish Passiko → Run workflow** and select `main`.

After a successful deployment, the preview is available at https://provatidis.github.io/passiko/. Subsequent pushes to `main` update the same address. Repository settings and the GitHub plan must permit Pages publishing.

### Existing clones and shared scenarios

The repository was renamed from `GPTCloudTest` to `degenerator`, then to `passiko` for release 1.10.0. Update existing clones with:

```sh
git remote set-url origin https://github.com/provatidis/passiko.git
```

GitHub redirects old repository links, but does not automatically redirect the old Pages site. For a previously shared scenario, replace `/GPTCloudTest/` or `/degenerator/` in the URL with `/passiko/` and retain the entire `#scenario=...` fragment. Asset and home links are relative, and new scenario links use the current site address.

The sandbox key remains `defi-sandbox-v1`; the `degenerator-*` keys for saved experiments, lesson progress, pool/position snapshots and same-tab Learn drafts also stay unchanged. Exported experiment libraries retain their version-1 `degenerator-experiments` kind, so older backups still import. Visible names and new download filenames use Passiko. Keeping these identifiers preserves saved work on the same `provatidis.github.io` origin. A different origin, including a custom domain, has separate browser storage. Existing local checkout directories can keep their names. If a cloud checkout directory is renamed, update its working-directory and startup configuration to the actual path.


## Working drafts during a Learn visit

Clicking a same-tab Learn link captures validated calculator inputs, the active lab and any matching source snapshot into `degenerator-learn-return-v1` in session storage. Returning restores the working drafts without changing saved experiments, lesson progress or latest chain snapshots, then consumes that temporary handoff. Explicit shared scenario links take precedence. Browser history restores cached pages directly; stale handoffs are cleared when such a page returns. Unsupported or unreadable handoff data is preserved, and blocked storage leaves navigation usable. Invalid incomplete inputs are not captured.
