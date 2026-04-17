# MineBench Client

[![MineBench logo](public/minebench-logo-yellow-150px.png)](https://minebench.cloud/)
  
MineBench Client is the desktop execution layer of the MineBench ecosystem. It
combines the benchmark runtime, miner orchestration, wallet-aware reward
surfaces, and device-local state needed to turn a user workstation into an
auditable mining edge node.

This repository is where user hardware, miner binaries, wallet UX, and product
controls meet. As a result, it has to balance operator-grade reliability with a
consumer-facing user experience.

## What this module owns

- hardware benchmarking and local capability detection
- miner process lifecycle management
- desktop wallet and rewards UX
- device-local telemetry and settings persistence
- multi-platform packaging for Windows, macOS, and Linux

## Mining mode
[![MineBench mining mode](/public/mining-mode.png)](https://minebench.cloud/downloads)

## Benchmark mode
[![MineBench mining mode](/public/benchmark-mode.png)](https://minebench.cloud/downloads)

## Cards with mining pool stats

[![MineBench mining mode](/public/minebench-preview.png)](https://minebench.cloud/downloads)

## $BMT utility token
Token listed on pumpfun - [buy $BMT token to support app development](https://pump.fun/coin/67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev)

## Architectural role

The client is the trust boundary closest to the user machine. It is responsible
for gathering device-level signals, launching local mining workflows, and
presenting benchmark and reward state without embedding backend-only authority.

That split matters:

- the desktop runtime may observe and submit state
- it must not own backend accounting or treasury logic
- any privileged infrastructure access has to remain server-side

## Technology stack

- Electron
- React
- TypeScript
- Vite

## Development

Install dependencies:

```bash
npm install
```

Run the integrated desktop development flow:

```bash
npm run dev:all
```

## Builds

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

## Configuration model

All local runtime values should stay in local environment files or machine-local
configuration only. Signing material, private endpoints, and operational
credentials must never be committed.

## Documentation

All repository documentation is grouped under [`docs/`](docs/README.md).

Recommended entry points:

- [`docs/README.md`](docs/README.md)
- [`docs/BUILD.md`](docs/BUILD.md)
- [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md)
- [`docs/TECHNICAL_REQUIREMENTS.md`](docs/TECHNICAL_REQUIREMENTS.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)

## Security posture

- never commit `.env` files
- never commit code-signing certificates or release keys
- never commit wallet secrets or internal API credentials
- keep reproducible build and release notes separate from privileged material

## License

MIT
