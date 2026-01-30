# 🎯 ШПАРГАЛКА - Windows Production Build

## Найпростіше Рішення (для вас прямо зараз)

### Запустіть ЦЮ команду:
```bash
npm run dist:win
```

### Готово ✅

Файл буде у: `dist/MineBench Client 0.4.4.exe`

---

## Що Вона Робить?

```
npm run dist:win
        ↓
    NODE_ENV=production (автоматично)
        ↓
    Загружає .env.production
        ↓
    Wallet Auth: https://minebench.cloud/auth ✅
    API Base: https://minebench.cloud/api ✅
    Solana RPC: mainnet-beta.solana.com ✅
        ↓
    npm run build:prod
        ↓
    electron-builder (creates .exe)
        ↓
    dist/MineBench Client 0.4.4.exe
```

---

## Альтернативи (якщо потрібно)

### Побудувати і встановити поступово:

```bash
# 1. Web версія
npm run build:prod

# 2. Windows installer
npm run dist:win
```

### Використати скрипт:

PowerShell:
```bash
.\build-windows-production.ps1
```

CMD:
```bash
build-windows-production.bat
```

---

## Перевірка (опціонально)

Перед або після можете перевірити:

```bash
npm run dev:prod
```

Клацніть ⚙️ і перевірте:
- ✅ Environment: production
- ✅ Wallet Auth: https://minebench.cloud/auth

---

## Часові Рамки

| Етап | Час |
|------|-----|
| Web build | 5-7 хв |
| Installer creation | 5-8 хв |
| **ВСЬОГО** | **10-15 хв** |

---

## Файл Результату

```
📁 dist/
  └── 📦 MineBench Client 0.4.4.exe (150-200 MB)
```

Це повний Windows installer готовий до розповсюдження.

---

## Якщо Помилка

### Помилка: "Internal compiler error"
```bash
# Перезавантажте комп'ютер
# Закрийте браузери
# Спробуйте ще раз
npm run dist:win
```

### Помилка: "makensis"
```bash
# Видаліть cache
rmdir "%LOCALAPPDATA%\electron-builder\Cache\nsis" /s /q
npm run dist:win
```

---

## Документи для Довідки

- [QUICK_BUILD_WINDOWS.md](QUICK_BUILD_WINDOWS.md) - Детальна інструкція
- [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md) - Конфіг
- [BUILD_ALL_PLATFORMS.md](BUILD_ALL_PLATFORMS.md) - Для інших ОС

---

## ✨ ГОТОВО?

```bash
npm run dist:win
```

Чекайте 10-15 хвилин. Все решта автоматично!

---

**Version:** 0.4.4  
**Status:** ✅ Production  
**Auth:** https://minebench.cloud/auth  
**Date:** Jan 29, 2026
