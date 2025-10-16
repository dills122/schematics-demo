import { strings } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema } from './schema';

const collectionPath = path.join(__dirname, '../collection.json');

describe('schematics-demo', () => {
  it('creates an Angular workspace and extends its package.json', async () => {
    const runner = new SchematicTestRunner('schematics', collectionPath);
    const options: Schema = { name: 'demo-app', skipInstall: true };
    const tree = await runner.runSchematic(
      'schematics-demo',
      options,
      Tree.empty()
    );

    const workspaceDirectory =
      options.directory ?? `.schematics/${strings.dasherize(options.name)}`;
    const packageJsonPath = `/${workspaceDirectory}/package.json`;

    expect(tree.files).toContain(packageJsonPath);

    const packageJsonBuffer = tree.read(packageJsonPath);
    expect(packageJsonBuffer).toBeDefined();
    const packageJson = JSON.parse(packageJsonBuffer!.toString('utf-8'));

    expect(packageJson.scripts.postgenerate).toBe(
      'echo "Project scaffolding extended by schematics-demo"'
    );
    expect(packageJson.dependencies?.['zone.js']).toBeUndefined();

    expect(tree.files).toContain(`/${workspaceDirectory}/src/styles.scss`);
    expect(tree.files).not.toContain(`/${workspaceDirectory}/src/styles.css`);
    expect(tree.files).not.toContain(`/${workspaceDirectory}/src/main.server.ts`);
    expect(tree.files).toContain(
      `/${workspaceDirectory}/zendesk/manifest.json`
    );
    expect(tree.files).toContain(
      `/${workspaceDirectory}/zendesk/translations/en.json`
    );
    expect(tree.files).toContain(`/${workspaceDirectory}/zcli.json`);

    const manifestBuffer = tree.read(
      `/${workspaceDirectory}/zendesk/manifest.json`
    );
    expect(manifestBuffer).toBeDefined();
    const manifest = JSON.parse(manifestBuffer!.toString('utf-8'));
    expect(manifest.name).toBe('Demo App');
    expect(manifest.author.name).toBe('Demo App');
    expect(manifest.author.email).toBe('support@demo-app.com');

    const readmeBuffer = tree.read(`/${workspaceDirectory}/zendesk/README.md`);
    expect(readmeBuffer).toBeDefined();
    expect(readmeBuffer!.toString('utf-8')).toMatch(/^# Demo App/m);

    const translationsBuffer = tree.read(
      `/${workspaceDirectory}/zendesk/translations/en.json`
    );
    expect(translationsBuffer).toBeDefined();
    const translations = JSON.parse(translationsBuffer!.toString('utf-8'));
    expect(translations.app.name).toBe('Demo App');
    expect(translations.app.short_description).toContain('Demo App');
    expect(translations.app.long_description).toContain('Demo App');

    const iframeBuffer = tree.read(
      `/${workspaceDirectory}/zendesk/assets/iframe.html`
    );
    expect(iframeBuffer).toBeDefined();
    expect(iframeBuffer!.toString('utf-8')).toContain('Hello from Demo App!');

    const zcliBuffer = tree.read(`/${workspaceDirectory}/zcli.json`);
    expect(zcliBuffer).toBeDefined();
    const zcliConfig = JSON.parse(zcliBuffer!.toString('utf-8'));
    expect(zcliConfig.apps[0].name).toBe('Demo App');
    expect(zcliConfig.apps[0].manifest).toBe('zendesk/manifest.json');
  });
});
