## Telegram setup

### 1) Create a Telegram bot

1. Open Telegram and search for "BotFather".
2. Send the command /newbot.
3. Follow the instructions to choose a name and username for your bot.
4. BotFather will give you an API token. Save it.

### 2) Install the Telegram plugin

```bash
pnpm clawdbot plugin install telegram
```

### 3) Configure the plugin

Edit the configuration file (usually `~/.openclaw/openclaw.json` or `~/.openclaw/openclaw_llamacpp.json`) and add the following:

```json
{
  "plugins": {
    "entries": {
      "telegram": {
        "enabled": true,
        "botToken": "YOUR_BOT_TOKEN_HERE",
        "dmPolicy": "pairing",
        "groupPolicy": "allowlist",
        "streamMode": "partial"
      }
    }
  }
}
```

Replace `YOUR_BOT_TOKEN_HERE` with the token you got from BotFather.

### 4) Start OpenClaw

```bash
pnpm clawdbot onboard --install-daemon
pnpm gateway:watch
```

### 5) Pair your bot

1. Open Telegram and search for your bot by username.
2. Send the command `/start`.
3. The bot will send you a pairing code.
4. In your terminal, run:

```bash
pnpm clawdbot tui
```

5. In the TUI, go to **Settings → Plugins → Telegram** and enter the pairing code.
6. Click **Pair**.

### 6) Test it

Send a message to your bot in Telegram. It should reply to you!
