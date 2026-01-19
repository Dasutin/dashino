import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Repo root is one level up from scripts/
const repoRoot = path.resolve(__dirname, '..');
const widgetsDir = path.join(repoRoot, 'widgets');
const assetsDir = path.join(repoRoot, 'dist', 'web', 'assets');

function existsDir(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

function controllerTypes() {
  if (!existsDir(widgetsDir)) return [];
  const entries = fs.readdirSync(widgetsDir, { withFileTypes: true });
  const exts = ['ts', 'tsx', 'js'];
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(type => {
      return exts.some(ext => fs.existsSync(path.join(widgetsDir, type, `widget.${ext}`)));
    });
}

function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : '';
}

function findInAssets(assets, needle) {
  for (const { name, content } of assets) {
    if (content.includes(needle)) return name;
  }
  return null;
}

function loadAssetContents() {
  if (!existsDir(assetsDir)) return [];
  const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  return files.map(name => ({
    name,
    content: fs.readFileSync(path.join(assetsDir, name), 'utf-8')
  }));
}

function main() {
  const types = controllerTypes();
  const assets = loadAssetContents();

  if (!assets.length) {
    console.error('No JS assets found under dist/web/assets. Did the build run?');
  }

  console.log(`Widgets with controllers: ${types.join(', ') || 'none'}`);
  console.log(`Scanning ${assets.length} asset file(s) in dist/web/assets`);

  for (const type of types) {
    const symbol = `create${capitalize(type)}Controller`;
    const matchSymbol = findInAssets(assets, symbol);
    const matchTypeSingle = findInAssets(assets, `'${type}'`);
    const matchTypeDouble = findInAssets(assets, `"${type}"`);
    const matchType = matchTypeSingle || matchTypeDouble;

    const symbolStatus = matchSymbol ? `symbol in ${matchSymbol}` : 'symbol missing';
    const typeStatus = matchType ? `string in ${matchType}` : 'string missing';
    console.log(`- ${type}: ${symbolStatus}; ${typeStatus}`);
  }
}

main();
