# QueMatic

Kiosk-style ready-order display for fast-food counters.

## Features

- Order numbers **1–9999** (up to 4 digits)
- Confirm entry with **Enter** (keyboard or numpad) — digits alone do not submit
- **\*** clears the in-progress buffer
- **#** (or numpad **−**) undoes the last posted number
- After **1 minute** with no input, a fullscreen waving Turkish-flag screensaver appears; any key dismisses it

## Run locally

Open `index.html` in a browser (double-click or serve the folder):

```bat
cd /d "%USERPROFILE%\Desktop\QueMatic"
start index.html
```

Or with Python:

```bat
cd /d "%USERPROFILE%\Desktop\QueMatic"
python -m http.server 8765
```

Then open http://127.0.0.1:8765/

## Files

- `index.html` — display layout + screensaver shell
- `styles.css` — kiosk styling + screensaver layout
- `app.js` — numpad/queue logic + idle screensaver + canvas flag wave
- `turkish-flag.svg` — static flag reference asset
