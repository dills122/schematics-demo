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

        const content = readFileSync(entrySourcePath);

        if (tree.exists(entryDestinationPath)) {
          tree.overwrite(entryDestinationPath, content);
        } else {
          tree.create(entryDestinationPath, content);
        }
      }
    };

    copyDirectory(zendeskSourceDir);

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
