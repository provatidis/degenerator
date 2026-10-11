# Development and architecture

[Project overview](../README.md) · [Product decisions](../DECISIONS.md)

## Run

Requires Node.js 22 or newer. No dependencies or installation step are needed.

```sh
git clone https://github.com/provatidis/degenerator.git
cd degenerator
npm start
```

For an existing clone, pull the latest `main` and run `npm start` from its checkout directory. No installation step is needed.

The HTTP server defaults to loopback port 3000. Set `HOST` and `PORT` to change its binding. It serves only the `public/` directory. To verify it:

```sh
curl --fail http://127.0.0.1:3000/
```

Open http://127.0.0.1:3000/ in your browser. No wallet, API key, network connection, or blockchain node is required to run the app locally.

## Test

```sh
npm test
```

Tests cover swap pricing, reserve conservation, fees, stale-quote rejection, balance validation, liquidity accounting, withdrawals, storage restoration and failures, plus the scenario model, versioned links, and CSV exports.

For an optional browser smoke test, install Chromium or set `CHROMIUM_BIN` to its executable, then run `npm run test:browser`. It starts temporary servers and checks actual page interactions at desktop and mobile sizes, including calculator results, copied links, CSV downloads, shared-link restoration, and persistence. The cloud container uses Chromium with its browser sandbox disabled for this local test; the app itself needs no browser installation to serve its files.

Set `TEST_BASE_URL` to a deployed site or a local server with a project subpath to test that target instead of starting the Node server. The browser smoke test checks that the home link, scripts, styles, and swaps work at that base URL.

## Focused workspaces and historical records

`public/ui/workspaces.js` controls visibility and top-level navigation without rebuilding feature controllers. `public/lib/workspace-links.js` maps existing fragments to Experiment, Inspect or Pool mechanics; `#historical-case` opens the recorded replay. Lab and snapshot controllers receive an activation callback from `main.js`, so explicit handoffs reveal the correct workspace while preserving drafts. Learn remains a separate document.

The period model lives in `public/models/fixed-position-period.js`; record validation is in `public/data/position-period.js`; values for display are in `public/lib/period-presentation.js`; the DOM controller is in `public/ui/position-period.js`. The development-only `scripts/check-replay.js` captures and independently checks a bounded fixed-position period. See [the replay method](replay.md).

## Project structure

- public/main.js: the single composition root. It initializes each UI controller and supplies the lab interfaces they need.
- public/ui/: explicit initializers for the sandbox, full-range lab, range lab, pool snapshots and navigation. Importing a controller does not start it.
- public/models/: pure calculations and protocol arithmetic. They do not read the DOM, browser storage or network.
- public/data/: chain deployment configuration, read-only RPC adapters, snapshot schemas and persistence.
- public/lib/: scenario links, exports, formatting and rendering utilities.
- public/styles/: shared foundation and components followed by feature styles. public/styles.css preserves the existing cascade order.
- public/index.html: semantic, static markup. Each feature owns its IDs; the structure check rejects duplicates.
- scripts/: development, integration and browser checks; test/: reference calculations and adapter/storage contracts.
- server.js: a local static server; GitHub Pages deploys public/ directly.

Run npm run check to verify module paths, circular dependencies, architectural boundaries, stylesheet imports, unique HTML IDs and the single entry point. CI runs this before calculation and browser tests. Existing scenario.js, amm.js and storage.js exports and storage keys remain compatible.

The structure review keeps the current dependency-free deployment. Explicit startup removes cross-controller import side effects; feature styles reduce collisions as labs grow. Shared tab behavior handles keyboard navigation consistently across the sandbox, labs and snapshot sources. ABI decoding, block pinning and snapshot-file/storage handling are shared by both protocol adapters; protocol identity checks remain adapter-specific. Static HTML remains appropriate at this size. Split markup or add a build step when repeated page layouts actually need it. A framework, database or application backend is not needed for read-only, public-chain imports.

## Architecture and extension policy

The static app remains dependency-free and deployable on GitHub Pages. Calculation models, transport/adapters, versioned persistence, exports and DOM controllers have separate responsibilities:

- public/models/: pure theoretical scenario calculations, guided experiments, and exact protocol arithmetic.
- public/data/: deployment configuration, read-only RPC transport, the Uniswap v2 adapter, snapshot schemas and storage.
- public/lib/: formatting, compatible scenario links, CSV output, download handling and result-card rendering.
- public/ui/: interface controllers, composed by public/main.js.
- public/scenario.js: compatibility exports for existing integrations and tests.
- public/examples/: recorded chain fixtures that work without an RPC request.

New financial models get their own versioned module and reference/invariant tests. New protocols get a deployment definition, adapter, exact token-unit handling and contract validation. Preserve old model links and storage keys; introduce explicit migrations when schemas change. Unit and desktop/mobile browser tests run before deployment.

Historical replay is the next model milestone. Validate one fixed-range period before expanding to editable ranges or additional deployments. A backend becomes useful for private provider credentials, shared caching, scheduled snapshots or account synchronization. Each can be added behind the data layer without rewriting the calculation models or existing labs.

The cl-range-v1 model, links, CSV, presentation helpers and result cards are separate modules. A shared link router and accessible lab navigation coordinate the two calculators while preserving cp50-v1 links. Reference tests cover asymmetric funding, outside starts, exact boundaries, continuity, virtual-reserve conservation, wide-range limits, separate fees, numerical bounds and reproducible exports.

## Browser identity and sharing

The arrow mark is supplied as an SVG favicon and a 16/32/48-pixel ICO fallback. Opaque 180-pixel Apple touch and 192/512-pixel maskable app icons accompany a manifest scoped to the project directory. The manifest supplies home-screen identity; the app continues to read live chain data only when requested.

Canonical, Open Graph and large-image social-card metadata use the published Pages URL. The 1200×630 preview is a committed PNG generated from an editable SVG. Its chart illustrates the default cl-range-v1 scenario before fees. Scenario fragments share the same site preview. A branded 404 page keeps its links inside /degenerator/, while a skip link and JavaScript-disabled notice provide clear entry points. The active skip link preserves shared scenario fragments when moving keyboard focus to the main content.

The structure check verifies linked files, metadata, PNG/ICO dimensions and manifest paths. The local server supplies correct image/manifest types and also serves /degenerator/ to mirror Pages links; missing resources keep HTTP status 404.

To regenerate the committed raster assets after editing the SVG sources, run node scripts/render-brand-assets.js in an environment with the optional Sharp graphics tool. SHARP_MODULE can point to its module entry file when Sharp is supplied externally. This is a maintainer-only tool, not a website dependency or required build step.

## Online preview with GitHub Pages

The workflow in `.github/workflows/pages.yml` tests the project and publishes only `public/` whenever `main` changes. It also runs tests on pull requests without publishing them. No hosting credentials or backend server are needed.

Enable it once in the repository's **Settings → Pages → Build and deployment → Source → GitHub Actions**. If the first workflow run happened before Pages was enabled, open **Actions → Test and publish Degenerator → Run workflow** and select `main`.

After a successful deployment, the preview is available at https://provatidis.github.io/degenerator/. Subsequent pushes to `main` update the same address. Repository settings and the GitHub plan must permit Pages publishing.

### Existing clones and shared scenarios

The repository was renamed from `GPTCloudTest` to `degenerator`. Update existing clones with:

```sh
git remote set-url origin https://github.com/provatidis/degenerator.git
```

GitHub redirects old repository links, but does not automatically redirect the old Pages site. For a previously shared scenario, replace `/GPTCloudTest/` in the URL with `/degenerator/` and retain the entire `#scenario=...` fragment. Asset and home links are relative, and new scenario links use the current site address.

The browser-storage key remains `defi-sandbox-v1`, preserving saved sandbox sessions on the same `provatidis.github.io` origin. A different origin, including a custom domain, has separate browser storage. Existing local checkout directories can keep their names. If a cloud checkout directory is renamed, update its working-directory and startup configuration to the actual path.

