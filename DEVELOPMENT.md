# Local development

The design prototypes intentionally run through a real Go backend. No Docker image is required at this stage.

## Prerequisites

- Node.js 22 or newer
- npm
- Go 1.24 or newer

## Start on CachyOS

```bash
git pull
make install
make dev
```

Then open <http://127.0.0.1:8080>.

`make dev` builds the Astro frontend and starts the Go backend, which serves both the generated frontend and `/api/*` from the same origin.

## Compare the three hero directions

- `/design/a/` — Focus Pane: typography and whitespace first
- `/design/b/` — Tiled Systems: Hyprland-like panes and system topology first
- `/design/c/` — Signal Field: GPU/WebGL atmosphere and network flow first

All three share the same Catppuccin Mocha-inspired tokens, Noto Sans CJK JP font stack, backend data, and accessibility constraints so the comparison is about layout and visual language rather than unrelated implementation differences.

## Checks

```bash
make test
```
