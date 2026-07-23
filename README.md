# Companion Expression Editor

A browser-based visual expression editor for [Bitfocus Companion](https://bitfocus.io/companion). It helps build Companion button expressions with Blockly blocks, preview the generated expression text, and import existing expressions back into the visual editor.

The app is standalone and client-side only. It does not connect to Companion or require a Companion API.

## Features

- Build expressions visually with Blockly.
- Copy expression text for Companion fields that have expression mode enabled.
- Paste an existing expression and load it into blocks for editing.
- Auto-save the current workspace in `localStorage`.
- Supports common Companion expression pieces:
  - variables like `$(internal:time_hms)`
  - nested variables, automatically serialized with `parseVariables(...)`
  - literals, ternaries, unary operators, and binary operators
  - functions such as `concat`, `toFixed`, `min`, `max`, `round`, `trim`, `includes`, `getVariable`, `bool`, and time helpers
  - variadic `concat`, `min`, and `max` blocks that grow as inputs are filled
  - Companion 5.0 collection helpers: `arrayMap`, `arrayFilter`, `arrayReduce`, `arrayForEach`, `arrayFind`, `arrayFindIndex`, `arraySome`, `arrayEvery`, `arraySort`, `arrayReverse`, `objectKeys`, and `objectValues`
  - native Blockly blocks for Companion 5.0 `let`/`const`, `if`/`else`, `while`, counting `for`, `for…of`, `return`, `break`, `continue`, arrow callbacks, and optional property access
  - strict visual import: constructs without a dedicated block are rejected instead of being hidden in a raw-code fallback

## Local Development

Install dependencies:

```sh
npm ci
```

Start the dev server:

```sh
npm run dev
```

The app is configured for the GitHub Pages base path, so the local URL is usually:

```text
http://127.0.0.1:5173/companion-expression-editor/
```

## Scripts

```sh
npm test
```

Runs unit tests with Vitest.

```sh
npm run test:browser
```

Runs Playwright browser tests.

```sh
npm run build
```

Type-checks and builds the static site into `dist/`.

```sh
npm run preview
```

Previews the production build locally.

## Deployment

This repo is configured for GitHub Pages at:

```text
https://parkerknabb.github.io/companion-expression-editor/
```

The Vite base path is set in `vite.config.ts`:

```ts
base: '/companion-expression-editor/'
```

Deployments are handled by `.github/workflows/deploy-pages.yml`. On pushes to `main`, GitHub Actions installs dependencies, runs unit tests, builds the app, and publishes `dist/` to GitHub Pages.

In the GitHub repository settings, Pages should use:

```text
Build and deployment -> Source -> GitHub Actions
```

## Notes

Generated expressions are intentionally unwrapped because this is meant for Companion fields where expression mode is enabled. For example, the editor outputs:

```js
$(custom:state) == "on" ? "Active" : "Idle"
```

not:

```js
$($(custom:state) == "on" ? "Active" : "Idle")
```

Unsupported valid syntax is rejected on import instead of being loaded in a lossy way.
