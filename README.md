# MineBench Client

MineBench Client is the desktop application for benchmarking and mining within
the MineBench ecosystem. It combines an Electron shell, React UI, local miner
integration, and wallet-aware flows for syncing rewards and statistics.

## Features

- desktop app for Windows, macOS, and Linux
- benchmark and mining workflows
- local miner process integration
- wallet-connected reward tracking
- multi-device statistics synchronization

## Stack

- Electron
- React
- TypeScript
- Vite

## Development

Install dependencies:

```bash
npm install
```

Run the local development flow:

```bash
npm run dev:all
```

## Builds

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

## Configuration

Local runtime values should be stored in local environment files only.
Do not commit signing material, certificates, or private endpoints.

## Notes

Mining software can trigger antivirus heuristics. Review binaries carefully and
publish reproducible build instructions for releases.

## Security

- never commit `.env` files
- never commit code-signing certificates
- never commit wallet secrets or internal API credentials

See `SECURITY.md` for vulnerability reporting.

## License

MIT
