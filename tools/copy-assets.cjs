const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');

const filesToCopy = [
  {
    source: path.join(projectRoot, 'src', 'collection.json'),
    destination: path.join(distRoot, 'src', 'collection.json'),
  },
  {
    source: path.join(projectRoot, 'src', 'schematics-demo', 'schema.json'),
    destination: path.join(distRoot, 'src', 'schematics-demo', 'schema.json'),
  },
  {
    source: path.join(projectRoot, 'src', 'schematics-demo', 'schema.d.ts'),
    destination: path.join(
      distRoot,
      'src',
      'schematics-demo',
      'schema.d.ts'
    ),
  },
];

try {
  for (const { source, destination } of filesToCopy) {
    if (!fs.existsSync(source)) {
      throw new Error(`Missing asset at ${source}`);
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  console.log('Copied schematic assets to dist/');
} catch (error) {
  console.error('Failed to copy schematic assets:', error);
  process.exitCode = 1;
}
