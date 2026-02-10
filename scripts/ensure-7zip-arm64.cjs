const fs = require('node:fs');
const path = require('node:path');

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  if (process.platform !== 'win32') return;
  if (process.arch !== 'arm64') return;

  const winDir = path.join(process.cwd(), 'node_modules', '7zip-bin', 'win');
  const source7za = path.join(winDir, 'x64', '7za.exe');
  const targetDir = path.join(winDir, 'arm64');
  const target7za = path.join(targetDir, '7za.exe');

  if (!fileExists(source7za)) {
    console.warn(`[ensure-7zip-arm64] Skipped: missing ${source7za}`);
    return;
  }

  if (fileExists(target7za)) {
    console.log('[ensure-7zip-arm64] OK: arm64 7za.exe already present');
    return;
  }

  ensureDir(targetDir);
  fs.copyFileSync(source7za, target7za);
  console.log('[ensure-7zip-arm64] Added win/arm64/7za.exe (copied from win/x64)');
}

main();
