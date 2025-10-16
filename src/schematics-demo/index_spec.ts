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
  });
});
