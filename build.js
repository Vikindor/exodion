const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const sourcesDir = path.join(rootDir, 'sources');
const destDir = path.join(rootDir, 'builds');
const unpackedDir = path.join(destDir, 'unpacked');
const packedDir = path.join(destDir, 'packed');
const manifestPath = path.join(sourcesDir, 'manifest.json');
const configPath = path.join(rootDir, 'config.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function copyDir(sourceDir, targetDir) {
  ensureDir(targetDir);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function replaceInFiles(dirPath, replacements) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      replaceInFiles(entryPath, replacements);
      continue;
    }

    if (!/\.(js|css|html)$/.test(entry.name)) {
      continue;
    }

    let content = fs.readFileSync(entryPath, 'utf8');
    for (const [token, value] of replacements) {
      content = content.split(token).join(value);
    }
    fs.writeFileSync(entryPath, content, 'utf8');
  }
}

function zipDir(sourceDir, archivePath) {
  if (fs.existsSync(archivePath)) {
    fs.rmSync(archivePath, { force: true });
  }

  const command = [
    "Compress-Archive",
    "-Path",
    "'*'",
    "-DestinationPath",
    `'${archivePath.replace(/'/g, "''")}'`,
    "-Force"
  ].join(' ');

  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', command],
    {
      cwd: sourceDir,
      stdio: 'inherit'
    }
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  if (!fs.existsSync(configPath)) {
    console.error('Missing config.json with apiToken');
    process.exit(1);
  }

  const manifest = readJson(manifestPath);
  const config = readJson(configPath);
  const archivePath = path.join(packedDir, `exodion-${manifest.version}.zip`);

  removeDir(destDir);
  ensureDir(unpackedDir);
  ensureDir(packedDir);

  copyDir(sourcesDir, unpackedDir);
  replaceInFiles(unpackedDir, [
    ['@@version', manifest.version],
    ['@@API_TOKEN', config.apiToken]
  ]);
  zipDir(unpackedDir, archivePath);

  console.log(`Built unpacked extension at ${unpackedDir}`);
  console.log(`Built archive at ${archivePath}`);
}

main();
