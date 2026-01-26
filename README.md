# 🚀 MineBench Client

Cross-platform desktop mining client built with Electron, React, and Three.js. Mine Monero (XMR) with an immersive 3D interface.

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## ✨ Features

- **🖥️ Cross-Platform**: Windows (x64, ARM64), macOS (Intel, Apple Silicon), Linux (x64)
- **⚡ CPU Mining**: Powered by XMRig 6.25.0
- **🎨 Modern UI**: Custom window frame, dark theme, React + Tailwind CSS
- **📊 Real-time Stats**: Live hashrate, temperature, rewards tracking
- **🌐 Multi-Node**: Monero RPC and P2Pool integration
- **🎮 3D Visualization**: Interactive reactor core with Three.js
- **⚙️ Thread Control**: Adjust CPU usage with slider
- **📈 Benchmarking**: Performance testing modes
- **🔒 Secure**: Local wallet management, encrypted sessions

## 📥 Installation

### Download Pre-built
Download the latest release for your platform:

### ⚠️ Antivirus Warnings

**Important**: Some antivirus software may flag MineBench as a threat because it includes XMRig mining software. This is a **false positive** - MineBench is legitimate, open-source software.

#### Why This Happens
- XMRig is a legitimate Monero mining tool
- Antivirus programs detect the mining signature and assume it's malware
- This affects ALL mining software, not just MineBench

#### How to Fix (Windows Defender)
1. Open **Windows Security** → **Virus & threat protection**
2. Click **Protection history**
3. Find the MineBench quarantine entry
4. Select **Actions** → **Allow on device**
5. Add to exclusions:
   - Go to **Virus & threat protection settings**
   - Click **Manage settings** → **Add or remove exclusions**
   - Add folder: `C:\Users\{YourName}\AppData\Local\Programs\MineBench Client`
   - Add folder: `C:\Users\{YourName}\AppData\Roaming\MineBench Client`

#### Other Antivirus Software
- **Avast/AVG**: Settings → Exceptions → Add exception → Browse to MineBench folder
- **Norton**: Settings → Antivirus → Exclusions/Low Risks → Add folder
- **Kaspersky**: Settings → Additional → Threats and Exclusions → Manage exclusions
- **McAfee**: Virus and Spyware Protection → Excluded Files → Add file/folder

#### Verify Safety
- Check the source code on [GitHub](https://github.com/devcodex2025/MineBench-Client)
- Scan with [VirusTotal](https://www.virustotal.com) (expect 5-15 false positives from heuristic scanners)
- Official XMRig: https://github.com/xmrig/xmrig

### Build from Source
```bash
# Install dependencies
npm install

# Development mode
npm run dev:all

# Build for production
npm run dist
```

## 🛠️ Tech Stack

- **Framework**: Electron 31
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS 4
- **3D Graphics**: Three.js + React Three Fiber
- **State**: Zustand
- **Mining**: XMRig 6.25.0
- **Build**: Vite + electron-builder

## ⚙️ Configuration

Create `.env` file:
```env
# RPC endpoint (monerod)
MB_RPC_HOST=xmr.minebench.cloud
MB_RPC_PORT=30595

# Stratum endpoint (P2Pool)
MB_POOL_URL=xmr.minebench.cloud:30832
```

## 📖 Usage

1. **Launch Application**: Open MineBench Client
2. **Wait for Node Sync**: Dashboard shows sync progress
3. **Configure Mining**: 
   - Go to "Mining Mode"
   - Adjust thread count with slider
   - Click "Start Mining"
4. **Monitor**: View real-time stats and logs
5. **Claim Rewards**: Accumulate 100+ $BMT to claim

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development
npm run dev:all

# Build icons
npm run build:icon

# Build for specific platform
npm run dist:win   # Windows
npm run dist:mac   # macOS
npm run dist:linux # Linux
npm run dist:all   # All platforms
```

## 📁 Project Structure

```
MineBench-Client/
├── electron/          # Main process
│   ├── main.cjs      # Electron main
│   └── preload.cjs   # Preload script
├── src/              # Renderer process
│   ├── components/   # React components
│   ├── pages/        # Application pages
│   ├── store/        # State management
│   └── lib/          # Utilities
├── Miner/            # XMRig binaries
│   └── Xmrig/
│       ├── win-x64/
│       ├── win-arm64/
│       ├── macos-x64/
│       ├── macos-arm64/
│       └── linux-x64/
└── build/            # Application icons
```

## 🚀 Releases

Automated releases via GitHub Actions:
```bash
npm version patch  # Bump version
git push --tags    # Trigger build
```

See [RELEASE.md](RELEASE.md) for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🔗 Links

- [Main Project](https://github.com/YOUR_USERNAME/MineBench-dApp)
- [Documentation](BUILD.md)
- [Release Notes](RELEASE.md)

## ⚠️ Disclaimer

This is mining software. Ensure you:
- Have adequate cooling
- Monitor hardware temperatures
- Comply with local regulations
- Understand mining risks

---

**Built with ❤️ by MineBench Team**
