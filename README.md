# Primer Behaviors

[![npm](https://img.shields.io/npm/v/@primer/behaviors)](https://www.npmjs.com/package/@primer/behaviors)
[![CI](https://github.com/primer/behaviors/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/primer/behaviors/actions/workflows/ci.yml)

Shared behaviors for JavaScript components

## Documentation

- [Anchored Position](/docs/anchored-position.md)
- [Focus Trap](/docs/focus-trap.md)
- [Focus Zone](/docs/focus-zone.md)
- [Scroll Into View](/docs/scroll-into-view.md)

## Installation

```bash
npm install @primer/behaviors
```

or

```bash
yarn add @primer/behaviors
```

## Storybook

```bash
npm run storybook
```

## Testing

```bash
npm test              # unit tests (jest + jsdom)
npm run test:browser  # layout tests in Chromium, Firefox and WebKit (Playwright)
```

`npm run test:browser` builds the package and runs the Playwright suite in
`tests/browser` against `dist/`. Install the browsers once with
`npx playwright install chromium firefox webkit`.
