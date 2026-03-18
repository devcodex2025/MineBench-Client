# Wayland Support Guide

## Overview

MineBench Client now includes native Wayland support for Linux distributions. Wayland is a modern display protocol that provides better security, performance, and resource efficiency compared to the older X11 protocol.

## Supported Wayland Compositors

✅ **Fully Supported:**
- GNOME (Ubuntu 24.04+, Fedora 40+, Debian 13+)
- KDE Plasma (6.0+)
- Sway
- Hyprland
- Weston
- Any Wayland compositor with Ozone support

## Quick Start

### Automatic Wayland Detection

The application automatically detects and enables Wayland support when running on a Wayland session:

```bash
npm run dev        # Auto-detects Wayland/X11
npm run dev:all    # Electron + Vite dev server
npm run dist:linux # Build AppImage with Wayland support
```

### Check Your Session Type

To verify if you're running on Wayland or X11:

```bash
# Check Wayland
echo $WAYLAND_DISPLAY
# Output: wayland-0 (Wayland session)
# Output: (empty - X11 session)

# Alternative check
echo $DISPLAY
# Output: :0 (X11 session)
# Output: :1 (X11 session with multiple displays)

# Or use loginctl
loginctl show-session -p Type
# Output: Type=wayland (Wayland session)
# Output: Type=x11 (X11 session)
```

### Force Wayland Session

To explicitly run on Wayland (if available):

```bash
# GNOME
GDMSESSION=gnome-wayland npm run dev

# KDE Plasma
GDMSESSION=plasmawayland npm run dev

# Generic Wayland
WAYLAND_DISPLAY=wayland-0 npm run dev
```

### Force X11 Fallback

If you encounter issues on Wayland and need to use X11:

```bash
WAYLAND_DISPLAY="" DISPLAY=:0 npm run dev
```

## Troubleshooting

### Issue: "GLXBadFBConfig" or "EGL_NOT_INITIALIZED"

**Cause:** OpenGL context creation failed on Wayland

**Solutions:**
```bash
# Option 1: Use X11 fallback
WAYLAND_DISPLAY="" DISPLAY=:0 npm run dev

# Option 2: Enable experimental GPU support
export __EGL_DRIVER=nvidia  # For NVIDIA
export MESA_GL_VERSION_OVERRIDE=4.6  # For Mesa
npm run dev

# Option 3: Update graphics drivers
# Ubuntu/Debian
sudo apt update && sudo apt upgrade

# Fedora
sudo dnf update

# Arch
sudo pacman -Syu
```

### Issue: Cursor appears jerky or unresponsive

**Cause:** Cursor rendering on Wayland with HiDPI displays

**Solution:**
```bash
# Disable fractional scaling temporarily
gsettings set org.gnome.mutter experimental-features "['scale-monitor-framebuffer']"

# Or use integer scaling
# GNOME Settings → Displays → Scale → Select whole numbers only
```

### Issue: Screen tearing or visual artifacts

**Cause:** Vsync issue with Wayland compositor

**Solutions:**
```bash
# Option 1: Enable Vsync at compositor level
# GNOME (usually enabled by default)
# KDE Plasma: System Settings → Display and Monitor → Compositor → Enable Vsync

# Option 2: Set environment variables
export vblank_mode=1  # For Mesa drivers
export __GL_SYNC_TO_VBLANK=1  # For NVIDIA

npm run dev
```

### Issue: GPU Mining (T-Rex) not detecting GPU on Wayland

**Cause:** GPU detection requires proper permissions

**Solutions:**
```bash
# Add user to video group
sudo usermod -aG video $USER
sudo usermod -aG render $USER

# Apply changes (requires logout/login or new terminal)
newgrp video
newgrp render

# Verify GPU access
glxinfo | grep "OpenGL version"
```

### Issue: Keyboard input not working

**Cause:** IME (Input Method Editor) not initialized

**Solution:**
The application automatically enables IME on Wayland. If you still experience issues:

```bash
# Restart Input Method service
ibus restart  # For GNOME
fcitx -r      # For KDE with Fcitx

npm run dev
```

## Performance Tips

### Enable Hardware Acceleration

```bash
export MESA_GL_VERSION_OVERRIDE=4.6
export mesa_glthread=true
npm run dev
```

### Optimize for Specific GPUs

**Intel GPU:**
```bash
export __LIBGL_DRICONF_GLES_VERSION=43000
npm run dev
```

**AMD GPU (RADV):**
```bash
export RADV_PERFTEST=aco
npm run dev
```

**NVIDIA GPU:**
```bash
export NVIDIA_DRIVER_CAPABILITIES=graphics,compute,display
npm run dev
```

## Building for Wayland

### Create a Wayland-optimized AppImage

```bash
# Standard build (includes Wayland support)
npm run dist:linux

# Build with explicit Wayland support verification
npm run build
npm run dist:linux

# Built AppImage: MineBench-Client-x.x.x-Linux-x64.AppImage
```

### Testing the AppImage

```bash
# Make executable
chmod +x MineBench-Client-*.AppImage

# Run on Wayland session
./MineBench-Client-*.AppImage

# Check what display protocol is being used
./MineBench-Client-*.AppImage 2>&1 | grep -i "wayland\|x11\|ozone"
```

## Development Notes

### Wayland-specific Code

The Electron main process includes Wayland detection:

```javascript
// From electron/main.cjs
if (process.platform === 'linux' && process.env.WAYLAND_DISPLAY) {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('enable-wayland-ime', 'true');
}
```

### Testing on Different Compositors

Create a test script:

```bash
#!/bin/bash

# test-wayland.sh

echo "Testing on different Wayland sessions..."

for compositor in gnome-wayland plasmawayland sway hyprland; do
  echo ""
  echo "Testing $compositor..."
  GDMSESSION=$compositor npm run dev 2>&1 | head -20
done
```

## Known Limitations

| Feature | Wayland | X11 | Status |
|---------|---------|-----|--------|
| Rendering | ✅ | ✅ | Full support |
| Keyboard | ✅ | ✅ | Full support |
| Mouse | ✅ | ✅ | Full support |
| 3D Graphics | ✅ | ✅ | Full support |
| Screen Capture | ⚠️ | ✅ | Needs PipeWire |
| Clipboard | ✅ | ✅ | Full support |
| GPU Detection | ✅ | ✅ | Requires permissions |
| Window Decorations | ✅ | ✅ | Full support |
| Hardware Acceleration | ✅ | ✅ | Full support |

## Environment Variables Reference

| Variable | Value | Purpose |
|----------|-------|---------|
| `WAYLAND_DISPLAY` | `wayland-0` | Force Wayland session |
| `DISPLAY` | `:0` | Use X11 |
| `__EGL_DRIVER` | `nvidia` | Specify EGL driver |
| `MESA_GL_VERSION_OVERRIDE` | `4.6` | Override OpenGL version |
| `vblank_mode` | `1` | Enable Vsync |
| `__GL_SYNC_TO_VBLANK` | `1` | NVIDIA Vsync |
| `mesa_glthread` | `true` | Enable Mesa threaded rendering |
| `RADV_PERFTEST` | `aco` | AMD GPU optimization |

## Reporting Issues

If you encounter Wayland-specific issues:

1. **Collect diagnostic info:**
```bash
# System info
uname -a
echo $WAYLAND_DISPLAY
echo $XDG_SESSION_TYPE

# GPU info
glxinfo | head -20
glx-info

# Wayland version
wayland-info

# Electron logs
npm run dev 2>&1 | tee wayland-debug.log
```

2. **Report on GitHub** with:
   - Output of above commands
   - Error messages from the application
   - Your Wayland compositor and version
   - Graphics driver and version

## Additional Resources

- [Electron Ozone Wayland Documentation](https://github.com/electron/electron/blob/main/docs/tutorial/linux-ozone.md)
- [Wayland Documentation](https://wayland.freedesktop.org/)
- [Mesa Wayland Support](https://mesonbuild.com/Wayland-support.html)
- [XDG Desktop Portal](https://github.com/flatpak/xdg-desktop-portal)

## Support

For Wayland-specific issues or questions:

1. Check the [Electron GitHub Issues](https://github.com/electron/electron/issues) with label `platform/linux`
2. Consult [Wayland Troubleshooting Guide](https://wiki.archlinux.org/title/Wayland)
3. Report to MineBench project with detailed logs

---

**Last Updated:** January 2026
**Electron Version:** 31.6.1+
**Status:** ✅ Production Ready
