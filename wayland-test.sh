#!/bin/bash
# wayland-test.sh - Test MineBench Client on different Wayland sessions

set -e

echo "========================================="
echo "MineBench Client - Wayland Test Script"
echo "========================================="
echo ""

# Check if we're on Linux
if [[ ! "$OSTYPE" == "linux-gnu"* ]]; then
    echo "❌ This script only runs on Linux"
    exit 1
fi

# Detect current session
echo "📋 Current Display Configuration:"
echo "  WAYLAND_DISPLAY: ${WAYLAND_DISPLAY:-'(not set)'}"
echo "  DISPLAY: ${DISPLAY:-'(not set)'}"
echo "  XDG_SESSION_TYPE: ${XDG_SESSION_TYPE:-'(not set)'}"
echo ""

# Check session type
SESSION_TYPE=$(loginctl show-session -p Type | cut -d= -f2)
echo "  Active Session: $SESSION_TYPE"
echo ""

# Check for common Wayland compositors
echo "🔍 Available Compositors:"

if command -v gnome-shell &> /dev/null; then
    echo "  ✅ GNOME (available)"
    GNOME_AVAILABLE=true
fi

if command -v kwin_wayland &> /dev/null; then
    echo "  ✅ KDE Plasma (available)"
    KDE_AVAILABLE=true
fi

if command -v sway &> /dev/null; then
    echo "  ✅ Sway (available)"
    SWAY_AVAILABLE=true
fi

if command -v hyprctl &> /dev/null; then
    echo "  ✅ Hyprland (available)"
    HYPRLAND_AVAILABLE=true
fi

if [ -z "$GNOME_AVAILABLE" ] && [ -z "$KDE_AVAILABLE" ] && [ -z "$SWAY_AVAILABLE" ] && [ -z "$HYPRLAND_AVAILABLE" ]; then
    echo "  ⚠️  No known Wayland compositors detected"
fi

echo ""

# GPU Information
echo "🎨 Graphics Configuration:"

if command -v glxinfo &> /dev/null; then
    GPU_VENDOR=$(glxinfo 2>/dev/null | grep "OpenGL vendor" | head -1 | sed 's/OpenGL vendor string: //')
    if [ -n "$GPU_VENDOR" ]; then
        echo "  GPU Vendor: $GPU_VENDOR"
    fi
    
    GL_VERSION=$(glxinfo 2>/dev/null | grep "OpenGL version" | head -1 | sed 's/OpenGL version string: //')
    if [ -n "$GL_VERSION" ]; then
        echo "  OpenGL Version: $GL_VERSION"
    fi
else
    echo "  ⚠️  glxinfo not installed (install: glx-utils)"
fi

if command -v eglinfo &> /dev/null; then
    echo "  ✅ EGL support available"
else
    echo "  ⚠️  eglinfo not installed (optional)"
fi

echo ""

# Check Wayland libraries
echo "📚 Wayland Libraries:"

if pkg-config --exists wayland-client 2>/dev/null; then
    WAYLAND_VER=$(pkg-config --modversion wayland-client)
    echo "  ✅ Wayland client: $WAYLAND_VER"
else
    echo "  ❌ Wayland client libraries not found"
fi

if pkg-config --exists libxkbcommon 2>/dev/null; then
    echo "  ✅ libxkbcommon available"
fi

echo ""

# Test Application Build
echo "🔨 Build Test:"

if [ ! -f "package.json" ]; then
    echo "  ❌ Not in MineBench Client directory"
    echo "     Please run from: MineBench-Client/"
    exit 1
fi

echo "  ✅ package.json found"

if grep -q "\"electron\":" package.json; then
    ELECTRON_VERSION=$(grep "\"electron\":" package.json | sed 's/.*"\^//' | sed 's/".*//')
    echo "  📦 Electron version: $ELECTRON_VERSION"
fi

echo ""

# Run tests
echo "🧪 Test Options:"
echo ""
echo "1. Run in current session"
echo "   npm run dev"
echo ""

if [ "$GNOME_AVAILABLE" = true ]; then
    echo "2. Force GNOME Wayland"
    echo "   GDMSESSION=gnome-wayland npm run dev"
    echo ""
fi

if [ "$KDE_AVAILABLE" = true ]; then
    echo "3. Force KDE Plasma Wayland"
    echo "   GDMSESSION=plasmawayland npm run dev"
    echo ""
fi

if [ "$SWAY_AVAILABLE" = true ]; then
    echo "4. Force Sway"
    echo "   WAYLAND_DISPLAY=wayland-0 npm run dev"
    echo ""
fi

echo "X. Force X11 fallback"
echo "   WAYLAND_DISPLAY=\"\" DISPLAY=:0 npm run dev"
echo ""

# Optional: Run selected test
echo "========================================="
echo ""

read -p "Would you like to run a test now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Running: npm run dev"
    echo ""
    npm run dev
fi
