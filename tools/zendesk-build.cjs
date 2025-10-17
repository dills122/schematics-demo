'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
  statSync,
  readFileSync,
} = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const angularConfigPath = path.join(projectRoot, 'angular.json');

if (!existsSync(angularConfigPath)) {
  console.error(`angular.json not found at ${angularConfigPath}.`);
  process.exit(1);
}

let angularConfig;
try {
  angularConfig = JSON.parse(readFileSync(angularConfigPath, 'utf-8'));
} catch (error) {
  console.error(`Unable to parse angular.json: ${error.message}`);
  process.exit(1);
}

const projects = angularConfig.projects ?? {};
const args = process.argv.slice(2);

let projectName;
const buildArgs = [];
let expectingProjectValue = false;

for (const arg of args) {
  if (expectingProjectValue) {
    projectName = arg;
    expectingProjectValue = false;
    continue;
  }

  if (arg === '--project' || arg === '-p') {
    expectingProjectValue = true;
    continue;
  }

  const projectFlagMatch = arg.match(/^--project=(.+)$/);
  if (projectFlagMatch) {
    projectName = projectFlagMatch[1];
    continue;
  }

  if (!projectName && !arg.startsWith('-')) {
    projectName = arg;
    continue;
  }

  buildArgs.push(arg);
}

if (expectingProjectValue) {
  console.error('Missing value for --project flag.');
  process.exit(1);
}

if (!projectName) {
  projectName = angularConfig.defaultProject;
}

if (!projectName) {
  const projectNames = Object.keys(projects);
  if (projectNames.length === 1) {
    projectName = projectNames[0];
  }
}

if (!projectName) {
  console.error('Unable to determine project name. Provide one with --project.');
  process.exit(1);
}

if (!projects[projectName]) {
  console.error(`Project "${projectName}" not found in angular.json.`);
  process.exit(1);
}

const ngArgs = ['ng', 'build', projectName, ...buildArgs];
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const buildResult = spawnSync(npxCommand, ngArgs, {
  stdio: 'inherit',
  cwd: projectRoot,
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const projectConfig = projects[projectName] ?? {};
const projectRootPath = path.join(projectRoot, projectConfig.root ?? '');
const zendeskSourceDir = path.join(projectRootPath, 'zendesk');

const distRoot = path.join(projectRoot, 'dist');
const distProjectRoot = path.join(distRoot, projectName);
const zendeskDestinationDir = path.join(distProjectRoot, 'zendesk');
const assetsDestinationDir = path.join(zendeskDestinationDir, 'assets');

mkdirSync(distProjectRoot, { recursive: true });

if (existsSync(zendeskSourceDir)) {
  rmSync(zendeskDestinationDir, { recursive: true, force: true });
  cpSync(zendeskSourceDir, zendeskDestinationDir, { recursive: true });
  console.log(`Copied zendesk assets from ${zendeskSourceDir} to ${zendeskDestinationDir}.`);
} else {
  console.warn(`Zendesk directory not found at ${zendeskSourceDir}; creating empty destination.`);
  rmSync(zendeskDestinationDir, { recursive: true, force: true });
  mkdirSync(zendeskDestinationDir, { recursive: true });
}

mkdirSync(assetsDestinationDir, { recursive: true });

const angularOutputCandidates = [
  path.join(distProjectRoot, 'browser'),
  path.join(distRoot, projectName, 'browser'),
  path.join(distRoot, projectName),
  path.join(distRoot, 'browser'),
];

const angularOutputDir = angularOutputCandidates.find((candidate) => {
  try {
    return existsSync(candidate) && statSync(candidate).isDirectory();
  } catch {
    return false;
  }
});

if (!angularOutputDir) {
  console.error(
    `Angular build output not found. Checked: ${angularOutputCandidates.join(', ')}`
  );
  process.exit(1);
}

const copyDirectoryContents = (source, destination, skipNames = new Set()) => {
  const entries = readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    if (skipNames.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destinationPath, { recursive: true });
      copyDirectoryContents(sourcePath, destinationPath, skipNames);
    } else if (entry.isFile()) {
      cpSync(sourcePath, destinationPath);
    }
  }
};

const skipNames =
  path.resolve(angularOutputDir) === path.resolve(distProjectRoot)
    ? new Set(['zendesk'])
    : new Set();

copyDirectoryContents(angularOutputDir, assetsDestinationDir, skipNames);

console.log(
  `Copied Angular build output from ${angularOutputDir} to ${assetsDestinationDir}.`
);
