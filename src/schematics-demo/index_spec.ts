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
    expect(tree.files).toContain(
      `/${workspaceDirectory}/zendesk/translations/fr.json`
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
    expect(manifest.defaultLocale).toBe('en');

    const readmeBuffer = tree.read(`/${workspaceDirectory}/zendesk/README.md`);
    expect(readmeBuffer).toBeDefined();
    const readme = readmeBuffer!.toString('utf-8');
    expect(readme).toMatch(/^# Demo App/m);
    expect(readme).toContain('support@demo-app.com');

    const translationsBufferEn = tree.read(
      `/${workspaceDirectory}/zendesk/translations/en.json`
    );
    expect(translationsBufferEn).toBeDefined();
    const translationsEn = JSON.parse(
      translationsBufferEn!.toString('utf-8')
    );
    expect(translationsEn.app.name).toBe('Demo App');
    expect(translationsEn.app.short_description).toContain('Demo App');
    expect(translationsEn.app.long_description).toContain('Demo App');

    const translationsBufferFr = tree.read(
      `/${workspaceDirectory}/zendesk/translations/fr.json`
    );
    expect(translationsBufferFr).toBeDefined();
    const translationsFr = JSON.parse(
      translationsBufferFr!.toString('utf-8')
    );
    expect(translationsFr.app.name).toBe('Demo App');
    expect(translationsFr.app.short_description).toContain('Demo App');
    expect(translationsFr.app.long_description).toContain('Demo App');

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

  it('allows overriding Zendesk metadata via schematic options', async () => {
    const runner = new SchematicTestRunner('schematics', collectionPath);
    const options: Schema = {
      name: 'support-buddy',
      skipInstall: true,
      zendeskDisplayName: 'Support Buddy',
      zendeskAuthorName: 'Acme Support',
      zendeskAuthorEmail: 'help@acme.com',
      zendeskDefaultLocale: 'fr',
      zendeskShortDescription: 'Short summary for Support Buddy.',
      zendeskLongDescription: 'Extended summary for Support Buddy.',
    };
    const tree = await runner.runSchematic(
      'schematics-demo',
      options,
      Tree.empty()
    );

    const workspaceDirectory =
      options.directory ??
      `.schematics/${strings.dasherize(options.name)}`;

    const manifest = JSON.parse(
      tree
        .read(`/${workspaceDirectory}/zendesk/manifest.json`)!
        .toString('utf-8')
    );
    expect(manifest.name).toBe('Support Buddy');
    expect(manifest.author.name).toBe('Acme Support');
    expect(manifest.author.email).toBe('help@acme.com');
    expect(manifest.defaultLocale).toBe('fr');

    const readme = tree
      .read(`/${workspaceDirectory}/zendesk/README.md`)!
      .toString('utf-8');
    expect(readme).toMatch(/^# Support Buddy/m);
    expect(readme).toContain('help@acme.com');
    expect(readme).toContain('Short summary for Support Buddy.');

    for (const locale of ['en', 'fr']) {
      const translations = JSON.parse(
        tree
          .read(
            `/${workspaceDirectory}/zendesk/translations/${locale}.json`
          )!
          .toString('utf-8')
      );
      expect(translations.app.name).toBe('Support Buddy');
      expect(translations.app.short_description).toBe(
        'Short summary for Support Buddy.'
      );
      expect(translations.app.long_description).toBe(
        'Extended summary for Support Buddy.'
      );
    }

    const zcliConfig = JSON.parse(
      tree
        .read(`/${workspaceDirectory}/zcli.json`)!
        .toString('utf-8')
    );
    expect(zcliConfig.apps[0].name).toBe('Support Buddy');
    expect(zcliConfig.apps[0].manifest).toBe('zendesk/manifest.json');
  });
});
