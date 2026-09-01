# Browser smoke tests

These tests protect browser-facing contracts that are difficult to cover with backend or static-output assertions alone.

Playwright runs the same smoke suite against Chromium, Firefox and WebKit. The suite intentionally stays small and checks stable behavior rather than pixel-perfect screenshots:

- no document-level horizontal overflow at representative desktop, phone and compact-landscape viewports;
- sane Hero geometry;
- Live Runtime successfully hydrating from the real Go backend;
- skim / inspect state transitions;
- terminal open, runtime command and focus restoration;
- mobile navigation open / close and focus restoration.

## Local run

Start the real application from the repository root:

```bash
make install
make dev
```

In another shell:

```bash
cd e2e
npm ci
npx playwright install chromium firefox webkit
npm test
```

The default test origin is `http://127.0.0.1:8080`. Override it with `PLAYWRIGHT_BASE_URL` when needed.

## Boundary

This suite is regression automation, not a substitute for real-device QA. In particular, Playwright's WebKit is not iOS Safari, and desktop automation cannot reproduce Chromium Android desktop-mode platform zoom behavior reliably. Those browser / device-specific paths remain real-device checks when compatibility logic changes.
