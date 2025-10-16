# Schematics Demo

This repository hosts a custom Angular schematic that bootstraps a zoneless, standalone Angular workspace with sensible defaults. Use it as a base for experimentation or publishing to npm.

## Prerequisites

- Node.js ≥ 20 is recommended to match the Angular devkit requirements.
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

The `.schematics/` folder is Git-ignored, so repeated runs stay out of version control.

## Manual CLI Invocation

If you prefer the raw CLI, you can run the compiled collection directly:

```bash
schematics ./src/collection.json:schematics-demo --name my-app --skip-install --debug=false
```

All options match the Angular `ng new` schematic, but defaults are prefilled for SCSS, zoneless runtime, no SSR, and no AI config.

### Publishing

When you're ready to publish:

```bash
npm run build
npm publish
```
