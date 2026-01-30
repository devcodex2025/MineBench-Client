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
- **🔐 Solana Wallet**: Browser-based authentication with Phantom/Solflare
- **🌐 Multi-Device**: Sync mining stats across multiple computers
- **💰 Reward Tracking**: View earnings per device and total
- **🌐 Multi-Node**: Monero RPC and P2Pool integration
- **🎮 3D Visualization**: Interactive reactor core with Three.js
- **⚙️ Thread Control**: Adjust CPU usage with slider
- **📈 Benchmarking**: Performance testing modes
- **🔒 Secure**: Cryptographic signatures, encrypted sessions

## 📥 Installation

### Download Pre-built
Download the latest release for your platform:

### Linux Wayland Support

MineBench Client now includes native Wayland support for modern Linux distributions (GNOME, KDE Plasma, Sway, etc.).

**For Wayland users:**
- The application automatically detects and enables Wayland support
- See [WAYLAND_SETUP.md](WAYLAND_SETUP.md) for troubleshooting and optimization tips

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

# Development mode (local URLs - localhost:3000)
npm run dev:local

# Development mode (production URLs - minebench.cloud)
npm run dev:prod

# Build for development
npm run build:dev

# Build for production
npm run build:prod

# Build distributables for Windows
npm run dist:win

# Build distributables for macOS
npm run dist:mac

# Build distributables for Linux
npm run dist:linux

# Build for all platforms
npm run dist:all
```

### Quick Windows Production Build

To build a production Windows installer with minebench.cloud authentication:

```bash
npm run dist:win
```

This automatically:
- ✅ Sets environment to production
- ✅ Loads minebench.cloud URLs
- ✅ Builds web assets
- ✅ Creates Windows installer (`.exe`)

**Result:** `dist/MineBench Client 0.4.4.exe` (~150-200 MB)

For detailed instructions, see [QUICK_BUILD_WINDOWS.md](QUICK_BUILD_WINDOWS.md)

## 🛠️ Tech Stack

- **Framework**: Electron 31
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS 4
- **3D Graphics**: Three.js + React Three Fiber
- **State**: Zustand
- **Mining**: XMRig 6.25.0
- **Build**: Vite + electron-builder

## ⚙️ Configuration

### Environment Configuration

MineBench Client supports multiple environment configurations for seamless development and production switching.

**Quick Start:**
```bash
# Local development (localhost)
npm run dev:local

# Test with production URLs
npm run dev:prod

# Build for production
npm run build:prod
```

**Environment URLs:**
- **Development**: `http://localhost:3000/auth` (wallet), `http://localhost:3000/api` (API)
- **Production**: `https://minebench.cloud/auth` (wallet), `https://minebench.cloud/api` (API)

For detailed configuration guide, see [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md).

### Mining Configuration

Create `.env` file:
```env
# RPC endpoint (monerod)
MB_RPC_HOST=xmr.minebench.cloud
MB_RPC_PORT=30595

# Stratum endpoint (P2Pool)
MB_POOL_URL=xmr.minebench.cloud:30832
```

## 📖 Usage

### Quick Start

1. **Launch Application**: Open MineBench Client
2. **Connect Solana Wallet** (Optional but recommended):
   - Click "Connect Solana Wallet" button in sidebar
   - Your system browser will open
   - Select Phantom, Solflare, or Magic Eden wallet
   - Approve connection and sign authentication message
   - Browser closes automatically, you're connected!
   - See [BROWSER_WALLET_QUICKSTART.md](BROWSER_WALLET_QUICKSTART.md)
3. **Wait for Node Sync**: Dashboard shows sync progress
4. **Configure Mining**: 
   - Go to "Mining Mode"
   - Adjust thread count with slider
   - Click "Start Mining"
5. **View Statistics**: 
   - Navigate to "Statistics" tab to see:
     - Total rewards across all devices
     - Individual device performance
     - 7-day reward history chart
     - Real-time hashrate graphs
6. **Monitor**: View real-time stats and logs
7. **Multi-Device**: Install on multiple computers, connect same wallet to sync stats

### Solana Wallet Benefits

When you connect a Solana wallet:
- ✅ Track mining across multiple devices
- ✅ View aggregated statistics
- ✅ Receive rewards to your Solana address (future)
- ✅ Participate in governance (future)
- ✅ Access exclusive features

**No wallet?** You can still mine, but statistics won't sync between devices.

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development (auto-detects Wayland/X11 on Linux)
npm run dev:all

# Build icons
npm run build:icon

# Build for specific platform
npm run dist:win   # Windows
npm run dist:mac   # macOS
npm run dist:linux # Linux (with Wayland support)
npm run dist:all   # All platforms
```

### Platform-Specific Notes

**Linux:**
- Wayland support enabled by default
- Automatic X11 fallback if needed
- See [WAYLAND_SETUP.md](WAYLAND_SETUP.md) for detailed setup

**macOS:**
- Supports Intel and Apple Silicon
- Requires macOS 11.0 or later

**Windows:**
- Supports x64 and ARM64
- Windows 10/11 recommended

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
