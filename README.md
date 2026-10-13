# Passiko

*See for yourself.*

A DeFi playground for learning liquidity mechanics and testing assumptions. Compare providing liquidity with holding the same starting tokens, or inspect a real Uniswap position at a recorded block.

[Open Experiment](https://provatidis.github.io/passiko/) · [Learn](https://provatidis.github.io/passiko/learn.html) · [Inspect a position](https://provatidis.github.io/passiko/#position-lab)

- **Experiment:** full-range and concentrated-liquidity calculators, ordered examples, and saved comparisons.
- **Learn:** six essentials lessons, a final challenge, three practical range exercises and three exercises using verified historical cases. Every topic is available directly.
- **Inspect:** Ethereum WETH/USDC pool and v3 NFT snapshots, principal, fee accounting and JSON exports.
- **Historical cases:** start with an in-range baseline, then follow a 33-hour position through exits and returns. Inspect interval fees, active/outside time and the holding comparison.
- **Pool mechanics:** a separate virtual swap and liquidity sandbox, linked from Experiment and Learn.

The calculators use hypothetical prices and assumed cash fees. Snapshots record on-chain state at one block. Historical cases calculate earned fee tokens and time in range from recorded periods, with independent accounting checks. These tools do not reconstruct a position’s lifetime profit; the fixed-position replay is not an arbitrary-range backtester. The interface identifies which kind of result you are viewing.

No wallet connection or transactions. The site runs on GitHub Pages; saved work stays in your browser unless exported.

## Run locally

Node.js 22 or later; no installation step or application dependencies.

```sh
npm start
npm test
npm run check
```

Open http://127.0.0.1:3000/ after starting the development server. Browser interaction checks run in CI before publication; see [development](docs/development.md) for the Chromium setup.

## Documentation

- [Using the tools and saved experiments](docs/guide.md)
- [Lesson goals, misconceptions and evidence](docs/learning.md)
- [Calculation models and assumptions](docs/models.md)
- [Historical replay method and recorded evidence](docs/replay.md)
- [Chain reads, fee accounting and snapshot validation](docs/data.md)
- [Architecture, local checks and deployment](docs/development.md)
- [Product decisions](DECISIONS.md)
- [Release history](CHANGELOG.md)

MIT licensed. The adapted Uniswap tick arithmetic retains its [separate notice](public/licenses/uniswap-v3-sdk.txt).
