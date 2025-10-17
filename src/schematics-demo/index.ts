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
    const scripts = { ...(packageJson.scripts ?? {}) };
    scripts.postgenerate = 'echo "Project scaffolding extended by schematics-demo"';
    scripts['build:zendesk'] = 'node tools/zendesk-build.cjs';
    packageJson.scripts = scripts;

    tree.overwrite(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n'
    );
    context.logger.info(`Added postgenerate script to ${packageJsonPath}.`);

    return tree;
  };

  const updateAngularJson: Rule = (tree: Tree, context: SchematicContext) => {
    const angularJsonPath = `${projectRoot}/angular.json`;

    if (!tree.exists(angularJsonPath)) {
      context.logger.warn(
        `Expected angular.json at ${angularJsonPath}, but it was not found.`
      );
      return tree;
    }

    const angularJsonBuffer = tree.read(angularJsonPath);
    if (!angularJsonBuffer) {
      context.logger.warn(
        `Unable to read ${angularJsonPath} to configure build options.`
      );
      return tree;
    }

    let angularJson: Record<string, unknown>;
    try {
      angularJson = JSON.parse(angularJsonBuffer.toString('utf-8'));
    } catch (error) {
      context.logger.warn(
        `Failed to parse ${angularJsonPath}: ${(error as Error).message}`
      );
      return tree;
    }

    const projects = angularJson.projects as Record<string, unknown> | undefined;
    if (!projects) {
      context.logger.warn('No projects section found in angular.json.');
      return tree;
    }

    const projectConfig = projects[normalizedOptions.name] as
      | {
          architect?: Record<string, any>;
          targets?: Record<string, any>;
        }
      | undefined;

    if (!projectConfig) {
      context.logger.warn(
        `Project ${normalizedOptions.name} not found in angular.json.`
      );
      return tree;
    }

    const targets = projectConfig.architect ?? projectConfig.targets;
    if (!targets) {
      context.logger.warn(
        `Project ${normalizedOptions.name} has no architect/targets section.`
      );
      return tree;
    }

    const buildTarget = targets['build'];
    if (buildTarget && typeof buildTarget === 'object') {
      buildTarget.options = buildTarget.options ?? {};
      buildTarget.options.baseHref = './';

      if (
        buildTarget.configurations &&
        typeof buildTarget.configurations === 'object'
      ) {
        Object.keys(buildTarget.configurations).forEach((configurationName) => {
          const configuration = buildTarget.configurations[configurationName];
          if (configuration && typeof configuration === 'object') {
            configuration.baseHref = './';
          }
        });
      }
    } else {
      context.logger.warn(
        `Build target not found for project ${normalizedOptions.name}.`
      );
    }

    if (!targets['build-zendesk']) {
      targets['build-zendesk'] = {
        builder: '@angular-devkit/architect:run-commands',
        options: {
          commands: [
            'node tools/zendesk-build.cjs',
          ],
          parallel: false,
        },
      };
    }

    tree.overwrite(
      angularJsonPath,
      JSON.stringify(angularJson, null, 2) + '\n'
    );
    context.logger.info(
      `Updated angular.json for project ${normalizedOptions.name}.`
    );

    return tree;
  };

  const ensureZendeskIndexSnippet: Rule = (
    tree: Tree,
    context: SchematicContext
  ) => {
    const indexHtmlPath = `${projectRoot}/src/index.html`;

    if (!tree.exists(indexHtmlPath)) {
      context.logger.warn(
        `Expected index.html at ${indexHtmlPath}, but it was not found.`
      );
      return tree;
    }

    const indexHtmlBuffer = tree.read(indexHtmlPath);
    if (!indexHtmlBuffer) {
      context.logger.warn(
        `Unable to read ${indexHtmlPath} to add Zendesk SDK snippet.`
      );
      return tree;
    }

    const indexHtmlContent = indexHtmlBuffer.toString('utf-8');
    if (indexHtmlContent.includes('zendesk_app_framework_sdk/2.0/zaf_sdk.min.js')) {
      context.logger.debug(
        'Zendesk SDK snippet already present in index.html. Skipping injection.'
      );
      return tree;
    }

    const scriptSnippet = [
      '  <script src="https://static.zdassets.com/zendesk_app_framework_sdk/2.0/zaf_sdk.min.js"></script>',
      '  <script>',
      '    // Initialise Apps framework client. See also:',
      '    // https://developer.zendesk.com/apps/docs/developer-guide/getting_started',
      '    var client = ZAFClient.init();',
      "    client.invoke('resize', { width: '100%', height: '200px' });",
      '  </script>',
    ].join('\n');

    const closingBodyTag = /<\/body>/i;
    if (!closingBodyTag.test(indexHtmlContent)) {
      context.logger.warn(
        `Could not find </body> tag in ${indexHtmlPath}. Zendesk snippet not injected.`
      );
      return tree;
    }

    const updatedIndexHtml = indexHtmlContent.replace(
      closingBodyTag,
      `${scriptSnippet}\n</body>`
    );

    tree.overwrite(indexHtmlPath, updatedIndexHtml);
    context.logger.info(
      `Injected Zendesk SDK snippet into ${indexHtmlPath}.`
    );

    return tree;
  };

  const ensureZendeskBuildScript: Rule = (
    tree: Tree,
    context: SchematicContext
  ) => {
    const scriptPath = `${projectRoot}/tools/zendesk-build.cjs`;
    const scriptLines = [
      "'use strict';",
      '',
      "const path = require('path');",
      "const { spawnSync } = require('child_process');",
      'const {',
      '  existsSync,',
      '  mkdirSync,',
      '  rmSync,',
      '  cpSync,',
      '  readdirSync,',
      '  statSync,',
      '  readFileSync,',
      "} = require('fs');",
      '',
      "const projectRoot = path.resolve(__dirname, '..');",
      "const angularConfigPath = path.join(projectRoot, 'angular.json');",
      '',
      'if (!existsSync(angularConfigPath)) {',
      '  console.error(`angular.json not found at ${angularConfigPath}.`);',
      '  process.exit(1);',
      '}',
      '',
      'let angularConfig;',
      'try {',
      "  angularConfig = JSON.parse(readFileSync(angularConfigPath, 'utf-8'));",
      '} catch (error) {',
      '  console.error(`Unable to parse angular.json: ${error.message}`);',
      '  process.exit(1);',
      '}',
      '',
      'const projects = angularConfig.projects ?? {};',
      'const args = process.argv.slice(2);',
      '',
      'let projectName;',
      'const buildArgs = [];',
      'let expectingProjectValue = false;',
      '',
      'for (const arg of args) {',
      '  if (expectingProjectValue) {',
      '    projectName = arg;',
      '    expectingProjectValue = false;',
      '    continue;',
      '  }',
      '',
      "  if (arg === '--project' || arg === '-p') {",
      '    expectingProjectValue = true;',
      '    continue;',
      '  }',
      '',
      '  const projectFlagMatch = arg.match(/^--project=(.+)$/);',
      '  if (projectFlagMatch) {',
      '    projectName = projectFlagMatch[1];',
      '    continue;',
      '  }',
      '',
      "  if (!projectName && !arg.startsWith('-')) {",
      '    projectName = arg;',
      '    continue;',
      '  }',
      '',
      '  buildArgs.push(arg);',
      '}',
      '',
      'if (expectingProjectValue) {',
      "  console.error('Missing value for --project flag.');",
      '  process.exit(1);',
      '}',
      '',
      'if (!projectName) {',
      '  projectName = angularConfig.defaultProject;',
      '}',
      '',
      'if (!projectName) {',
      '  const projectNames = Object.keys(projects);',
      '  if (projectNames.length === 1) {',
      '    projectName = projectNames[0];',
      '  }',
      '}',
      '',
      'if (!projectName) {',
      "  console.error('Unable to determine project name. Provide one with --project.');",
      '  process.exit(1);',
      '}',
      '',
      'if (!projects[projectName]) {',
      "  console.error(`Project \"${projectName}\" not found in angular.json.`);",
      '  process.exit(1);',
      '}',
      '',
      "const ngArgs = ['ng', 'build', projectName, ...buildArgs];",
      "const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';",
      'const buildResult = spawnSync(npxCommand, ngArgs, {',
      "  stdio: 'inherit',",
      '  cwd: projectRoot,',
      '});',
      '',
      'if (buildResult.status !== 0) {',
      '  process.exit(buildResult.status ?? 1);',
      '}',
      '',
      'const projectConfig = projects[projectName] ?? {};',
      "const projectRootPath = path.join(projectRoot, projectConfig.root ?? '');",
      "const zendeskSourceDir = path.join(projectRootPath, 'zendesk');",
      '',
      "const distRoot = path.join(projectRoot, 'dist');",
      "const distProjectRoot = path.join(distRoot, projectName);",
      "const zendeskDestinationDir = path.join(distProjectRoot, 'zendesk');",
      "const assetsDestinationDir = path.join(zendeskDestinationDir, 'assets');",
      '',
      'mkdirSync(distProjectRoot, { recursive: true });',
      '',
      'if (existsSync(zendeskSourceDir)) {',
      '  rmSync(zendeskDestinationDir, { recursive: true, force: true });',
      '  cpSync(zendeskSourceDir, zendeskDestinationDir, { recursive: true });',
      '  console.log(`Copied zendesk assets from ${zendeskSourceDir} to ${zendeskDestinationDir}.`);',
      '} else {',
      '  console.warn(`Zendesk directory not found at ${zendeskSourceDir}; creating empty destination.`);',
      '  rmSync(zendeskDestinationDir, { recursive: true, force: true });',
      '  mkdirSync(zendeskDestinationDir, { recursive: true });',
      '}',
      '',
      'mkdirSync(assetsDestinationDir, { recursive: true });',
      '',
      'const angularOutputCandidates = [',
      "  path.join(distProjectRoot, 'browser'),",
      "  path.join(distRoot, projectName, 'browser'),",
      "  path.join(distRoot, projectName),",
      "  path.join(distRoot, 'browser'),",
      '];',
      '',
      'const angularOutputDir = angularOutputCandidates.find((candidate) => {',
      '  try {',
      '    return existsSync(candidate) && statSync(candidate).isDirectory();',
      '  } catch {',
      '    return false;',
      '  }',
      '});',
      '',
      'if (!angularOutputDir) {',
      '  console.error(',
      "    `Angular build output not found. Checked: ${angularOutputCandidates.join(', ')}`",
      '  );',
      '  process.exit(1);',
      '}',
      '',
      'const copyDirectoryContents = (source, destination, skipNames = new Set()) => {',
      '  const entries = readdirSync(source, { withFileTypes: true });',
      '',
      '  for (const entry of entries) {',
      '    if (skipNames.has(entry.name)) {',
      '      continue;',
      '    }',
      '',
      '    const sourcePath = path.join(source, entry.name);',
      '    const destinationPath = path.join(destination, entry.name);',
      '',
      '    if (entry.isDirectory()) {',
      '      mkdirSync(destinationPath, { recursive: true });',
      '      copyDirectoryContents(sourcePath, destinationPath, skipNames);',
      '    } else if (entry.isFile()) {',
      '      cpSync(sourcePath, destinationPath);',
      '    }',
      '  }',
      '};',
      '',
      'const skipNames =',
      '  path.resolve(angularOutputDir) === path.resolve(distProjectRoot)',
      "    ? new Set(['zendesk'])",
      '    : new Set();',
      '',
      'copyDirectoryContents(angularOutputDir, assetsDestinationDir, skipNames);',
      '',
      'console.log(',
      "  `Copied Angular build output from ${angularOutputDir} to ${assetsDestinationDir}.`",
      ');',
      '',
    ];
    const scriptContent = `${scriptLines.join('\n')}`;

    if (tree.exists(scriptPath)) {
      tree.overwrite(scriptPath, scriptContent);
    } else {
      tree.create(scriptPath, scriptContent);
    }

    context.logger.info(
      `Created Zendesk build helper at ${scriptPath}.`
    );

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
    ensureZendeskIndexSnippet,
    updateAngularJson,
    extendPackageJson,
    ensureZendeskBuildScript,
    copyZendeskDirectory,
  ]);
}
