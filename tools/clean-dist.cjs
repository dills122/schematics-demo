const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');

try {
  fs.rmSync(distPath, { recursive: true, force: true });
  console.log(`Removed ${distPath}`);
} catch (error) {
  console.error(`Failed to remove ${distPath}:`, error);
  process.exitCode = 1;
}
