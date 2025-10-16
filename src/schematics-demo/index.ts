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
import { isObservable, lastValueFrom } from 'rxjs';

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

  let normalizedOptions = {
    ...options,
    name: dasherizedName,
    directory: defaultDirectory,
    routing: options.routing ?? true,
    style: options.style ?? 'scss',
    standalone: options.standalone ?? true,
    zoneless: options.zoneless ?? true,
    skipInstall: options.skipInstall ?? true,
    zendeskDisplayName: options.zendeskDisplayName,
    zendeskAuthorName: options.zendeskAuthorName,
    zendeskAuthorEmail: options.zendeskAuthorEmail,
    zendeskDefaultLocale: options.zendeskDefaultLocale,
    zendeskShortDescription: options.zendeskShortDescription,
    zendeskLongDescription: options.zendeskLongDescription,
  };

  const getZendeskContext = () => {
    const fallbackDisplayName =
      options.name && options.name.length > 0
        ? toDisplayName(options.name)
        : 'Zendesk App';
    const appDisplayName =
      normalizedOptions.zendeskDisplayName &&
      normalizedOptions.zendeskDisplayName.trim().length > 0
        ? normalizedOptions.zendeskDisplayName.trim()
        : fallbackDisplayName;
    const authorName =
      normalizedOptions.zendeskAuthorName &&
      normalizedOptions.zendeskAuthorName.trim().length > 0
        ? normalizedOptions.zendeskAuthorName.trim()
        : appDisplayName;
    const authorEmail =
      normalizedOptions.zendeskAuthorEmail &&
      normalizedOptions.zendeskAuthorEmail.trim().length > 0
        ? normalizedOptions.zendeskAuthorEmail.trim()
        : `support@${dasherizedName}.com`;
    const defaultLocale =
      normalizedOptions.zendeskDefaultLocale &&
      normalizedOptions.zendeskDefaultLocale.trim().length > 0
        ? normalizedOptions.zendeskDefaultLocale.trim()
        : 'en';
    const shortDescriptionOverride =
      normalizedOptions.zendeskShortDescription &&
      normalizedOptions.zendeskShortDescription.trim().length > 0
        ? normalizedOptions.zendeskShortDescription.trim()
        : undefined;
    const longDescriptionOverride =
      normalizedOptions.zendeskLongDescription &&
      normalizedOptions.zendeskLongDescription.trim().length > 0
        ? normalizedOptions.zendeskLongDescription.trim()
        : undefined;

    const templateVariables: Record<string, string> = {
      appDisplayName,
      authorName,
      authorEmail,
      defaultLocale,
      shortDescription:
        shortDescriptionOverride ?? `${appDisplayName} short description.`,
      longDescription:
        longDescriptionOverride ?? `${appDisplayName} long description.`,
      readmeDescription:
        shortDescriptionOverride ?? `[brief description of ${appDisplayName}]`,
    };

    return {
      appDisplayName,
      authorName,
      authorEmail,
      defaultLocale,
      shortDescriptionOverride,
      longDescriptionOverride,
      templateVariables,
    };
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

  const promptForZendeskOptions: Rule = async (
    tree: Tree,
    context: SchematicContext
  ) => {
    const workflow = context.engine.workflow as
      | {
          options?: { interactive?: boolean };
          promptProvider?: (
            definitions: Array<{
              id: string;
              type: string;
              message: string;
              default?: string;
            }>
          ) => unknown;
        }
      | undefined;

    if (!workflow || workflow.options?.interactive === false) {
      return tree;
    }

    const promptProvider = workflow.promptProvider;
    if (!promptProvider) {
      return tree;
    }

    const prompts: Array<{
      id: string;
      type: string;
      message: string;
      default?: string;
    }> = [];

    if (!normalizedOptions.zendeskDisplayName) {
      prompts.push({
        id: 'zendeskDisplayName',
        type: 'input',
        message: 'Zendesk display name',
        default:
          options.name && options.name.length > 0
            ? toDisplayName(options.name)
            : 'Zendesk App',
      });
    }

    if (!normalizedOptions.zendeskAuthorName) {
      prompts.push({
        id: 'zendeskAuthorName',
        type: 'input',
        message: 'Zendesk author name',
        default: undefined,
      });
    }

    if (!normalizedOptions.zendeskAuthorEmail) {
      prompts.push({
        id: 'zendeskAuthorEmail',
        type: 'input',
        message: 'Zendesk author/support email address',
        default: `support@${dasherizedName}.com`,
      });
    }

    if (!normalizedOptions.zendeskDefaultLocale) {
      prompts.push({
        id: 'zendeskDefaultLocale',
        type: 'input',
        message: 'Zendesk default locale (e.g. en, fr, es)',
        default: 'en',
      });
    }

    if (!normalizedOptions.zendeskShortDescription) {
      prompts.push({
        id: 'zendeskShortDescription',
        type: 'input',
        message: 'Zendesk short description',
      });
    }

    if (!normalizedOptions.zendeskLongDescription) {
      prompts.push({
        id: 'zendeskLongDescription',
        type: 'input',
        message: 'Zendesk long description',
      });
    }

    if (prompts.length === 0) {
      return tree;
    }

    const promptResult = promptProvider(prompts);
    const answers = isObservable(promptResult)
      ? await lastValueFrom(promptResult)
      : await Promise.resolve(
          promptResult as Promise<Record<string, string>>
        );

    if (answers && typeof answers === 'object') {
      normalizedOptions = {
        ...normalizedOptions,
        ...answers,
      };
    }

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
    const {
      appDisplayName,
      authorName,
      authorEmail,
      defaultLocale,
      shortDescriptionOverride,
      longDescriptionOverride,
      templateVariables,
    } = getZendeskContext();

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

    const renderTemplate = (
      templateContent: string,
      variables: Record<string, string>
    ) =>
      templateContent.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(variables, key)) {
          return variables[key];
        }
        return match;
      });

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
                name: authorName,
                email: authorEmail,
              };
              if (defaultLocale) {
                manifest.defaultLocale = defaultLocale;
              }
              content = JSON.stringify(manifest, null, 2) + '\n';
            } catch (error) {
              context.logger.warn(
                `Failed to template manifest.json: ${(error as Error).message}`
              );
              content = fileText;
            }
          } else if (
            posixRelativePath.startsWith('translations/') &&
            posixRelativePath.endsWith('.json')
          ) {
            try {
              const translations = JSON.parse(fileText);
              const appTranslations = translations.app ?? {};
              const shortDescription =
                shortDescriptionOverride ??
                (appTranslations.short_description
                  ? appTranslations.short_description.replace(
                      /zen tunes/gi,
                      appDisplayName
                    )
                  : `${appDisplayName} short description.`);
              const longDescription =
                longDescriptionOverride ??
                (appTranslations.long_description
                  ? appTranslations.long_description.replace(
                      /zen tunes/gi,
                      appDisplayName
                    )
                  : `${appDisplayName} long description.`);
              translations.app = {
                ...appTranslations,
                name: appDisplayName,
                short_description: shortDescription,
                long_description: longDescription,
              };
              content = JSON.stringify(translations, null, 2) + '\n';
            } catch (error) {
              context.logger.warn(
                `Failed to template ${posixRelativePath}: ${
                  (error as Error).message
                }`
              );
              content = fileText;
            }
          } else if (posixRelativePath === 'README.md') {
            content = renderTemplate(fileText, templateVariables);
          } else if (posixRelativePath === 'assets/iframe.html') {
            content = renderTemplate(fileText, templateVariables);
          } else {
            content = renderTemplate(fileText, templateVariables);
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
    promptForZendeskOptions,
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
