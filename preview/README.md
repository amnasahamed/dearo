# Dearo visual QA harness

This is a developer-only rendering harness, not a web product, PWA, iOS emulator, or native acceptance environment. It imports the **same** `src/ui/DearoApp.tsx` and components, rendered through React Native Web. Production native adapters remain unchanged.

## Run locally

From the project root:

```sh
npm ci
npm ci --prefix preview
node preview/build.cjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory preview/dist
```

Open `http://127.0.0.1:4173` on the same computer. Keep loopback binding; do not publish a tunnel. Root esbuild and React versions are reused by the bundler. Preview dependencies have a separate lockfile. Generated `preview/dist` is excluded from source archives.

Select a synthetic scenario and 390×568 or 320×568 frame. The 390×420 option checks a reduced content area, **not** an iOS keyboard. All native boundaries are mocked: event/preferences use memory only; contacts are fictitious; WhatsApp only records an in-memory URL; copy/share/review do not access the operating system. All external links are blocked. Reloading resets fixtures. Safe-area insets are zero. Native Alert is a visibly labelled HTML stand-in requiring an explicit click.

No real personal data should be entered. The preview is not a persistence, contact permission, StoreKit, WhatsApp, accessibility, native font, keyboard or iOS performance test. Use `docs/IOS_RELEASE.md` for remaining native release gates.
