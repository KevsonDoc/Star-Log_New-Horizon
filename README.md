# Star Log: New Horizons

A new journey among the stars, logged one adventure at a time.

## Requirements

- Node.js 24.22.1 LTS
- npm 11 or newer

Use the repository's pinned Node.js release with nvm:

```sh
nvm install 24.22.1
nvm use 24.22.1
npm ci
```

## Development

```sh
npm run dev
```

This builds the application before starting its watchers, so a clean checkout works immediately. It recompiles TypeScript, rebuilds Tailwind CSS, renders the HTML pages, and reloads the browser when files change. Open <http://localhost:2000>.

## Production

```sh
npm ci
npm run build
```

Deploy `dist/`, `package.json`, and `package-lock.json` to the runtime environment, then run:

```sh
npm ci --omit=dev
npm start
```

`npm start` only runs the compiled HTTP server. It does not compile sources or load development tools. The server publishes only `dist/public`. The Phaser runtime is copied into that public output during the build, so it does not need to be installed on the production server.

## Structure

```text
src/
  game/
    config/       Game settings and asset catalogue
    domain/       Match health, damage, and outcome rules, independent of Phaser
    input/        Keyboard controls
    scenes/       Phaser scene orchestration and presentation
    systems/      Projectile pool and physics integration
  server/
    app.ts        HTTP routes and public file serving
    index.ts      Production entry point
    dev/          Development entry point and LiveReload
  web/
    pages/        HTML page sources
    partials/     Shared navigation
    styles/       Tailwind and fonts
public/assets/    Images, audio, fonts, and original asset credits
scripts/          Build and asset rendering tools
tests/            Domain and HTTP boundary checks
dist/
  server/         Compiled server code
  public/         Files published to the browser
```

Node and browser code use separate TypeScript configurations. Phaser's bundled TypeScript declarations are used directly; no separate Phaser types package is required.

Projectiles share one collision handler, reuse a bounded pool, and are disabled when they hit the target or leave the screen.

## Validation

```sh
npm run typecheck
npm test
npm run build
```
