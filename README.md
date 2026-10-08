# WebOS

A complete desktop operating system that runs entirely in your web browser, with user accounts, a real window manager, a file system, 17 apps and 12 games. No server, no build step and no dependencies are required.

## Running it

Pick any of these:

- **Open `index.html`** in a modern browser (Chrome, Edge, Firefox, Safari). It works straight from disk (`file://`).
- **Use the single-file build:** `dist/webos.html` contains the whole OS in one file. You can copy it anywhere and open it.
- **Host it:** enable GitHub Pages for this repo, or serve the folder with any static server (`npx serve .`).

The first time it starts, you create an account. Each account has its own private files, settings and high scores, all stored in your browser (IndexedDB plus localStorage). Nothing is uploaded anywhere.

## What's inside

### Desktop
- Boot screen, login, lock screen, and multiple user accounts with optional (hashed) passwords
- Windows that can be dragged, resized from any edge, minimized and maximized, and that snap to the left half, right half or full screen when dragged to an edge
- Taskbar with pinned apps, running windows, a clock and calendar flyout, and quick settings (dark mode, volume, brightness, do not disturb, fullscreen)
- Start menu with search across apps and files, quick math (`12*7` → 84) and web search
- Desktop icons you can drag around, rubber-band select, right-click menus, and drag-and-drop file import from your computer
- Notifications, a Trash with restore, a cut/copy/paste clipboard, and file associations ("Open with")
- 12 wallpapers or your own image, light and dark themes, accent colors, and a mobile/touch-friendly layout

### Apps
| App | What it does |
| --- | --- |
| **Files** | Explorer with sidebar, breadcrumbs, icon and detail views, search, drag-and-drop, upload/download, Trash |
| **Notepad** | Text editor with find and replace, word wrap, zoom, Markdown preview, print |
| **Code Studio** | Code editor with syntax highlighting, tabs, file tree, live HTML preview and a JavaScript console |
| **Terminal** | Bash-like shell: `ls cd cat grep find tree head tail sort wc mv cp rm mkdir`, pipes, `>`/`>>`, `&&`, wildcards, Tab completion, history, `neofetch`, `matrix`, and more (type `help`) |
| **Browser** | Tabbed browser with bookmarks and a home page; also opens local HTML and PDF files |
| **Paint** | Brush, pencil, eraser, fill, shapes, text, spray, color picker, undo/redo, filters, saves PNGs |
| **Photos** | Gallery and viewer with zoom, pan, rotate, slideshow, and "set as wallpaper" |
| **Music** | Player with visualizer and five built-in songs generated in code; plays your own MP3/WAV/OGG files |
| **Video Player** | Plays your MP4/WebM files |
| **Calculator** | Standard and scientific modes, history, memory, full keyboard support |
| **Clock** | Analog and world clocks, alarms, stopwatch with laps, timer |
| **Calendar** | Month view, events with colors, reminders at event time |
| **Sticky Notes** | Colored notes with autosave and search |
| **Weather** | Live forecasts for any city or your location ([Open-Meteo](https://open-meteo.com), no API key needed) |
| **Task Manager** | Running windows (End task), FPS and memory graphs, storage breakdown, users |
| **Settings** | Personalization, taskbar and desktop, sound, date and time, account and password, default apps, backup/restore, factory reset |
| **Help & Tips** | Getting-started guide |

### Games
Snake · Blocks (Tetris-style, with hold, ghost piece and levels) · Minesweeper (3 difficulties) · 2048 (with undo) · Solitaire (Klondike, draw 1 or 3) · Chess (full rules, 3 AI levels or 2 players) · Connect Four (AI or 2 players) · Tic-Tac-Toe (unbeatable AI) · Breakout (levels and power-ups) · Flappy Bird · Pong · Memory Match

Best scores are saved per account.

## Keyboard shortcuts
| Keys | Action |
| --- | --- |
| `Ctrl+Space` | Open the Start menu |
| `Ctrl+S` / `Ctrl+O` / `Ctrl+N` | Save / open / new in editors |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V`, `Delete`, `F2` | File operations on the desktop and in Files |
| Double-click a title bar | Maximize or restore |
| Drag a window to a screen edge | Snap it |

## Project structure
```
index.html          entry point
css/os.css          shell, windows, menus, theme variables
css/apps.css        app and game styles
js/core/            util, icons, fs (virtual file system), wm (window manager),
                    system (settings, launching, dialogs, menus), fileops, shell, session
js/apps/            one file per app
js/games/           one file per game
tools/build.js      bundles everything into dist/webos.html
```

## Adding your own app
Create `js/apps/hello.js` and add a `<script>` tag for it in `index.html`:

```js
OS.registerApp({
  id: 'hello', name: 'Hello', icon: 'about', category: 'Apps', width: 400, height: 300,
  launch(win, args) {
    win.body.append(U.h('div', { style: { padding: '20px' } }, 'Hello, ' + OS.user.name + '!'));
    win.onKey(e => console.log('key', e.key));          // only fires while this window is focused
    win.interval(() => {}, 1000);                         // cleaned up automatically on close
  },
});
```

Useful APIs include `OS.fs` (read, write, list, mkdir, move…), `OS.dialog` (alert, confirm, prompt, file pickers), `OS.notify`, `OS.menu`, `OS.data` (per-user storage) and `OS.sound`.

After changing files, run `node tools/build.js` to regenerate the single-file build.
