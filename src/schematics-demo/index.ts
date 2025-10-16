import {
  Rule,
  SchematicContext,
  Tree,
  chain,
  externalSchematic,
} from '@angular-devkit/schematics';
import { strings } from '@angular-devkit/core';
import { Schema } from './schema';
import { readFileSync, readdirSync, statSync } from 'fs';
import * as path from 'path';

const { version: angularCliVersion } = require('@schematics/angular/package.json') as {
  version: string;
};

export function schematicsDemo(options: Schema): Rule {
  const dasherizedName = strings.dasherize(options.name);
  const defaultDirectory = options.directory ?? `.schematics/${dasherizedName}`;

  const toDisplayName = (value: string): string => {
    const spaced = value
      .replace(/[-_\s]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2');

    return spaced
      .split(' ')
      .filter(Boolean)
      .map(
        (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      )
      .join(' ');
  };

  const appDisplayName =
    options.name && options.name.length > 0
      ? toDisplayName(options.name)
      : 'Zendesk App';
  const supportEmail = `support@${dasherizedName}.com`;

  const normalizedOptions = {
    ...options,
    name: dasherizedName,
    directory: defaultDirectory,
    routing: options.routing ?? true,
    style: options.style ?? 'scss',
    standalone: options.standalone ?? true,
    zoneless: options.zoneless ?? true,
    skipInstall: options.skipInstall ?? true,
  };

  const normalizedDirectory =
    normalizedOptions.directory && normalizedOptions.directory.length > 0
      ? normalizedOptions.directory.replace(/\\/g, '/')
      : normalizedOptions.name;
  const projectRoot = normalizedDirectory.startsWith('/')
    ? normalizedDirectory
    : `/${normalizedDirectory}`;
  const packageJsonPath = `${projectRoot}/package.json`;

  const extendPackageJson: Rule = (tree: Tree, context: SchematicContext) => {
    if (!tree.exists(packageJsonPath)) {
      context.logger.warn(
        `Expected package.json at ${packageJsonPath}, but it was not generated.`
      );
      return tree;
    }

    const packageJsonBuffer = tree.read(packageJsonPath);
    if (!packageJsonBuffer) {
      context.logger.warn(
        `Unable to read package.json at ${packageJsonPath} after generating the Angular app.`
      );
      return tree;
    }

    const packageJson = JSON.parse(packageJsonBuffer.toString('utf-8'));
    packageJson.scripts = {
      ...packageJson.scripts,
      postgenerate: 'echo "Project scaffolding extended by schematics-demo"',
    };

    tree.overwrite(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n'
    );
    context.logger.info(`Added postgenerate script to ${packageJsonPath}.`);

    return tree;
  };

  const copyZendeskDirectory: Rule = (
    tree: Tree,
    context: SchematicContext
  ) => {
    const sourceCandidates = [
      path.resolve(__dirname, '..', '..', 'zendesk'),
      path.resolve(__dirname, '..', '..', '..', 'zendesk'),
    ];

    const zendeskSourceDir = sourceCandidates.find((candidate) => {
      try {
        return statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    });

    if (!zendeskSourceDir) {
      context.logger.warn(
        'Zendesk directory not found. Skipping zendesk asset copy.'
      );
      return tree;
    }

    const zendeskDestinationRoot = `${projectRoot}/zendesk`;

    const toPosixPath = (filePath: string) =>
      filePath.split(path.sep).join('/');

    const isBinaryFile = (fileName: string) => {
      const binaryExtensions = new Set([
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.ico',
        '.svg',
      ]);
      return binaryExtensions.has(path.extname(fileName).toLowerCase());
    };

    const copyDirectory = (currentSourceDir: string) => {
      const entries = readdirSync(currentSourceDir, { withFileTypes: true });

      for (const entry of entries) {
        const entrySourcePath = path.join(currentSourceDir, entry.name);
        const relativePath = path
          .relative(zendeskSourceDir, entrySourcePath)
          .split(path.sep)
          .join('/');
        const entryDestinationPath = `${zendeskDestinationRoot}/${relativePath}`.replace(
          /\\/g,
          '/'
        );

        if (entry.isDirectory()) {
          copyDirectory(entrySourcePath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        let content: Buffer | string;

        if (isBinaryFile(entry.name)) {
          content = readFileSync(entrySourcePath);
        } else {
          const fileText = readFileSync(entrySourcePath, 'utf-8');
          const posixRelativePath = toPosixPath(relativePath);

          if (posixRelativePath === 'manifest.json') {
            try {
              const manifest = JSON.parse(fileText);
              manifest.name = appDisplayName;
              manifest.author = {
                ...manifest.author,
                name: appDisplayName,
                email: supportEmail,
              };
              content = JSON.stringify(manifest, null, 2) + '\n';
            } catch (error) {
              context.logger.warn(
                `Failed to template manifest.json: ${(error as Error).message}`
              );
              content = fileText;
            }
          } else if (posixRelativePath === 'translations/en.json') {
            try {
              const translations = JSON.parse(fileText);
              translations.app = {
                ...translations.app,
                name: appDisplayName,
                short_description: translations.app?.short_description
                  ? translations.app.short_description.replace(
                      /zen tunes/gi,
                      appDisplayName
                    )
                  : `${appDisplayName} short description.`,
                long_description: translations.app?.long_description
                  ? translations.app.long_description.replace(
                      /zen tunes/gi,
                      appDisplayName
                    )
                  : `${appDisplayName} long description.`,
              };
              content = JSON.stringify(translations, null, 2) + '\n';
            } catch (error) {
              context.logger.warn(
                `Failed to template translations/en.json: ${
                  (error as Error).message
                }`
              );
              content = fileText;
            }
          } else if (posixRelativePath === 'README.md') {
            const templatedReadme = fileText.replace(
              /^# .+$/m,
              `# ${appDisplayName}`
            );
            content = templatedReadme;
          } else if (posixRelativePath === 'assets/iframe.html') {
            const templatedIframe = fileText.replace(
              /Hello, World!/g,
              `Hello from ${appDisplayName}!`
            );
            content = templatedIframe;
          } else {
            content = fileText;
          }
        }

        if (tree.exists(entryDestinationPath)) {
          tree.overwrite(entryDestinationPath, content);
        } else {
          tree.create(entryDestinationPath, content);
        }
      }
    };

    copyDirectory(zendeskSourceDir);

    const zcliConfigPath = `${projectRoot}/zcli.json`;
    const zcliConfig = {
      apps: [
        {
          name: appDisplayName,
          manifest: 'zendesk/manifest.json',
        },
      ],
    };
    const zcliContent = JSON.stringify(zcliConfig, null, 2) + '\n';

    if (tree.exists(zcliConfigPath)) {
      tree.overwrite(zcliConfigPath, zcliContent);
    } else {
      tree.create(zcliConfigPath, zcliContent);
    }

    context.logger.info(
      `Copied zendesk assets into ${zendeskDestinationRoot}.`
    );

    return tree;
  };

  return chain([
    externalSchematic('@schematics/angular', 'ng-new', {
      name: normalizedOptions.name,
      version: angularCliVersion,
      directory: normalizedOptions.directory,
      routing: normalizedOptions.routing,
      style: normalizedOptions.style,
      standalone: normalizedOptions.standalone,
      zoneless: normalizedOptions.zoneless,
      skipInstall: normalizedOptions.skipInstall,
      ssr: false,
      aiConfig: ['none'],
    }),
    extendPackageJson,
    copyZendeskDirectory,
  ]);
}
