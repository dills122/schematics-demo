# Schematics Demo

This repository hosts a custom Angular schematic that bootstraps a zoneless, standalone Angular workspace with sensible defaults. Use it as a base for experimentation or publishing to npm.

## Prerequisites

- Node.js ≥ 20 is required to satisfy the Angular devkit toolchain.
- (Optional) Install the Schematics CLI globally if you want to invoke the schematic directly:

  ```bash
  npm install -g @angular-devkit/schematics-cli
  ```

## Local Development

- Install dependencies: `npm install`
- Compile the TypeScript sources: `npm run build`
- Run unit tests (Jasmine): `npm run test`
- Exercise the schematic end-to-end: `npm run scaffold`
  - The script builds the package and generates an Angular app named `dev-app` under `.schematics/dev-app`
  - Override the name (and output directory) with `npm run scaffold -- --name my-app`
- Quick iteration helpers:
  - `npm run clean:workspaces` removes the `.schematics/` playground directory.
  - `npm run generate:dry` runs the schematic in dry-run mode.
  - `npm run generate:test` runs the schematic and writes files (identical to the final step of `npm run scaffold`).

The `.schematics/` folder is Git-ignored, so repeated runs stay out of version control.

## Consuming the Package

1. Install the schematic in the target workspace:

   ```bash
   npm install --save-dev schematics-demo
   ```

2. Generate a project using the Angular CLI:

   ```bash
   ng g schematics-demo:schematics-demo --name my-app
   ```

   All options mirror `ng new`; SCSS, zoneless mode, no SSR, and no AI config are preselected.

## Manual CLI Invocation

If you prefer the raw CLI, you can run the compiled collection directly:

```bash
schematics ./dist/src/collection.json:schematics-demo --name my-app --skip-install --debug=false
```

All options match the Angular `ng new` schematic, but defaults are prefilled for SCSS, zoneless runtime, no SSR, and no AI config.

## Publishing

Before publishing, inspect the packaged tarball:

```bash
npm run build
npm run pack
```

When ready, push the release to npm:

```bash
npm publish
```

### Zendesk

To generate new zendesk data, use this command

```bash
npx @zendesk/zcli apps:new
```
