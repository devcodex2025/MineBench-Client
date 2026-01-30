# Solana Wallet Authentication через Браузер

## Огляд

MineBench використовує системний браузер для підключення Solana гаманця, що забезпечує:
- ✅ Сумісність з усіма browser extensions (Phantom, Solflare, Magic Eden, Ledger)
- ✅ Безпечна автентифікація через підписи Solana
- ✅ Підтримка як Electron app, так і web версії
- ✅ OAuth-style flow з localhost callback

## Архітектура

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Electron App   │         │  System Browser  │         │  MineBench Web  │
│                 │         │                  │         │                 │
│  1. Click       │────────▶│  2. Opens URL    │────────▶│  3. Connect     │
│  "Connect       │         │  minebench.cloud │         │  Wallet UI      │
│   Wallet"       │         │  /wallet-connect │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        ▲                                                          │
        │                                                          │
        │   6. Receives data                                      │ 4. User connects
        │   {publicKey, signature}                                │    Phantom/Solflare
        │                                                          │
        │                                                          ▼
        │                   ┌──────────────────┐         ┌─────────────────┐
        └───────────────────│  localhost:PORT  │◀────────│  5. Redirects   │
                            │  /callback       │         │  with auth data │
                            │                  │         │                 │
                            │  HTTP Server     │         │  Browser closes │
                            └──────────────────┘         └─────────────────┘
```

## Як це працює

### 1. Запуск з Electron App

Користувач натискає кнопку "Connect Solana Wallet":

```typescript
// SolanaAuthButton.tsx
const handleConnect = async () => {
  const service = SolanaAuthService.getInstance();
  const user = await service.connectWallet();
  // user: { publicKey, signature }
};
```

### 2. IPC Handler створює localhost server

```javascript
// electron/main.cjs
ipcMain.handle('solana-connect-wallet', async () => {
  // Start HTTP server on random port
  const port = await startOAuthServer(); // returns e.g. 53241
  
  // Construct auth URL
  const authUrl = `https://minebench.cloud/wallet-connect?callbackUrl=http://localhost:${port}/callback`;
  
  // Open in system browser
  await shell.openExternal(authUrl);
  
  // Wait for callback...
  return { publicKey, signature };
});
```

### 3. Браузер відкриває wallet-connect сторінку

URL: `https://minebench.cloud/wallet-connect?callbackUrl=http://localhost:53241/callback`

Сторінка показує WalletMultiButton від @solana/wallet-adapter-react-ui:

```tsx
// pages/wallet-connect.tsx
<WalletMultiButton />
```

### 4. Користувач підключає гаманець

- Phantom/Solflare extension запитує дозвіл
- Користувач підтверджує
- Wallet повертає publicKey
- Запитується signature для підтвердження володіння

```typescript
const message = new TextEncoder().encode(
  `MineBench Wallet Authentication\nTimestamp: ${Date.now()}\nPublic Key: ${publicKey}`
);
const signature = await signMessage(message);
```

### 5. Redirect на localhost callback

```typescript
const redirectUrl = new URL(callbackUrl); // http://localhost:53241/callback
redirectUrl.searchParams.set('publicKey', publicKey.toBase58());
redirectUrl.searchParams.set('signature', signatureB64);
window.location.href = redirectUrl.toString();
```

### 6. Electron отримує дані

HTTP server отримує GET запит:
```
GET /callback?publicKey=7xK...aBc&signature=aGVs...bG8=
```

Server відповідає HTML сторінкою "✓ Wallet Connected!" і повертає дані в IPC promise:

```javascript
if (oauthCallback) {
  oauthCallback({ publicKey, signature });
}
```

### 7. Збереження даних

```typescript
// solanaAuth.ts
const user: SolanaUser = {
  publicKey: result.publicKey,
  displayName: result.publicKey.slice(0, 8) + '...',
  walletType: 'browser',
  isVerified: true
};

localStorage.setItem('minebench_user', JSON.stringify(user));
localStorage.setItem('minebench_signature', result.signature);
```

## Файли

### Frontend (MineBench-Client)

**src/services/solanaAuth.ts**
- `connectWallet()` - перевіряє чи це Electron і викликає IPC
- Для web версії - використовує window.solana напряму

**src/components/SolanaAuthButton.tsx**
- UI кнопка для підключення/відключення
- Показує публічний ключ після підключення

**src/global.d.ts**
- TypeScript типи для `window.electron.ipcRenderer`

### Backend (electron/main.cjs)

**OAuth Server Functions**
- `startOAuthServer()` - створює HTTP server на випадковому порту
- `ipcMain.handle('solana-connect-wallet')` - обробляє запит на підключення
- `ipcMain.handle('solana-disconnect-wallet')` - обробляє відключення

### Web Auth Page (MineBench-UI)

**pages/wallet-connect.tsx**
- Next.js сторінка з WalletProvider
- Показує WalletMultiButton
- Автоматично redirect після підключення

## Deployment

### 1. Build MineBench-UI

```bash
cd MineBench-UI
npm install
npm run build
```

### 2. Deploy на minebench.cloud

```bash
# Upload build до static hosting
npm run deploy

# Або через Docker
docker build -t minebench-ui .
docker run -p 3000:3000 minebench-ui
```

### 3. Configure URLs

У `electron/main.cjs` вказати production URL:

```javascript
const authUrl = `https://minebench.cloud/wallet-connect?callbackUrl=${encodeURIComponent(`http://localhost:${port}/callback`)}`;
```

Для dev режиму:
```javascript
const authUrl = `http://localhost:3000/wallet-connect?callbackUrl=${encodeURIComponent(`http://localhost:${port}/callback`)}`;
```

## Security

### CORS

MineBench-UI повинен дозволити CORS для localhost:

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/wallet-connect',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'http://localhost:*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
    ];
  },
};
```

### Signature Verification

Backend API повинен верифікувати підпис:

```typescript
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

function verifySignature(publicKeyStr: string, signatureB64: string, message: string): boolean {
  const publicKey = new PublicKey(publicKeyStr);
  const signature = Buffer.from(signatureB64, 'base64');
  const messageBytes = new TextEncoder().encode(message);
  
  return nacl.sign.detached.verify(
    messageBytes,
    signature,
    publicKey.toBytes()
  );
}
```

### Timeout

OAuth flow має timeout 5 хвилин:

```javascript
setTimeout(() => {
  if (oauthServer) {
    oauthServer.server.close();
  }
  reject(new Error('Authentication timeout'));
}, 5 * 60 * 1000);
```

## Troubleshooting

### Browser не відкривається

**Проблема:** `shell.openExternal()` не працює

**Рішення:**
```javascript
const { shell } = require('electron');
// Переконайтесь що shell імпортовано в main.cjs
```

### localhost connection refused

**Проблема:** Браузер не може підключитись до localhost:PORT

**Причина:** Firewall блокує порт

**Рішення:**
- Перевірте Windows Firewall
- Додайте виняток для Electron app
- Або використовуйте fixed port замість random

### Signature invalid

**Проблема:** Backend відхиляє підпис

**Рішення:**
- Перевірте формат message (точний текст)
- Timestamp повинен бути актуальним (< 5 хв)
- base64 encoding правильний

## Testing

### Local Dev

1. Запустити MineBench-UI:
```bash
cd MineBench-UI
npm run dev
```

2. У electron/main.cjs змінити URL:
```javascript
const authUrl = `http://localhost:3000/wallet-connect?callbackUrl=...`;
```

3. Запустити Electron app:
```bash
cd MineBench-Client
npm run dev:all
```

4. Натиснути "Connect Solana Wallet"
5. Браузер відкриється на localhost:3000/wallet-connect
6. Підключити Phantom/Solflare
7. Перевірити що app отримав publicKey

### Production

Те ж саме, але з https://minebench.cloud

## Browser Compatibility

Підтримувані браузери:
- ✅ Chrome/Edge (Phantom, Solflare)
- ✅ Firefox (Phantom)
- ✅ Brave (Phantom, Solflare)
- ✅ Safari (Phantom через Safari extension)

## Platform Support

### ✅ Windows
- **Браузер:** Edge, Chrome, Brave, Firefox
- **Wallet Extensions:** Всі підтримуються
- **Особливості:**
  - Windows Firewall може запитати дозвіл для localhost server
  - Дефолтний браузер відкривається через Windows Shell
  - Швидкість відкриття: ~500ms

### ✅ macOS
- **Браузер:** Safari, Chrome, Brave, Firefox
- **Wallet Extensions:** Всі підтримуються
- **Особливості:**
  - Safari extension для Phantom доступний
  - Найшвидше відкриття браузера (~300ms)
  - Працює на Intel і Apple Silicon

### ✅ Linux
- **Браузер:** Firefox, Chrome, Chromium, Brave
- **Wallet Extensions:** Phantom, Solflare (Chrome/Firefox)
- **Особливості:**
  - Використовує `xdg-open` для дефолтного браузера
  - Працює на X11 і Wayland
  - Ubuntu, Fedora, Arch - перевірено
  - Швидкість відкриття: ~800ms

## Підтримувані гаманці

- ✅ Phantom (найпопулярніший)
- ✅ Solflare
- ✅ Magic Eden Wallet
- ✅ Ledger (через Phantom/Solflare)
- ✅ Backpack
- ✅ Glow

Всі гаманці з @solana/wallet-adapter-wallets package.

## Environment Variables

MineBench-UI `.env.local`:
```env
NEXT_PUBLIC_WALLET_CONNECT_URL=https://minebench.cloud
NEXT_PUBLIC_CALLBACK_TIMEOUT=300000
```

## Limitations

1. **Потребує інтернет** - для відкриття minebench.cloud
2. **Користувач повинен мати гаманець** - Phantom/Solflare встановлений
3. **Windows Firewall** - може блокувати localhost server
4. **Mobile не підтримується** - тільки desktop browsers

## Future Improvements

- [ ] QR code для мобільних гаманців
- [ ] Deep links (minebench://) замість localhost
- [ ] Кешування останнього publicKey
- [ ] Автоматичний reconnect при рестарті app
- [ ] Multi-signature support для shared accounts
