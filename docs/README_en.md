# Bangumini

A lightweight, keyboard-first anime tracking desktop app.

## Features

**Collections** — Browse your entire library by status. Currently-watching entries are intelligently sorted against today's broadcast calendar.

**Daily Schedule** — View this season's anime timetable by weekday. See at a glance what's airing today.

**Search** — Search the Bangumi database with support for Chinese, Japanese, and Pinyin initial fuzzy matching.

**Subject Details** — Read synopses, browse staff and cast, check ratings and rankings. Adjust watch progress with arrow keys and commit with Enter, right from the detail page.

**Next Season** — Preview upcoming anime, grouped by weekday with airing times. Entries matched to Bangumi link directly to their detail pages.

**Global Shortcut** — Press `Ctrl+Shift+B` to toggle the window. The shortcut is customizable in Settings.

## Keyboard Controls

The entire app is designed for keyboard-only operation:

| Key | Action |
|-----|--------|
| `Tab` | Switch sidebar tab |
| `↑` `↓` | Move focus in list |
| `←` `→` | Turn pages / switch weekday / adjust progress |
| `Enter` | Open entry / confirm action |
| `Esc` / `Backspace` | Go back |
| `Ctrl+K` | Open collection status palette on detail page |
| `Ctrl+Enter` | Copy entry name to clipboard |
| `Ctrl+O` | Open entry in browser |
| `Ctrl+R` | Refresh airing times (watching list) |

## Screenshots

![screenshot](image.png)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/) 1.70+
- Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) with the "Desktop development with C++" workload

### Quick Start

```bash
# Install frontend dependencies
npm install

# Start dev server with hot reload
npm run tauri dev

# Build for production
npm run tauri build
```

`npm run tauri dev` launches both the Vite dev server and a Tauri window. Frontend changes are reflected instantly.
