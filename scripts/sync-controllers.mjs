import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const widgetsDir = path.join(repoRoot, 'widgets');
const controllersDir = path.join(repoRoot, 'web', 'src', 'controllers');

const exts = ['ts', 'tsx', 'js'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyControllers() {
  ensureDir(controllersDir);

  const entries = fs.readdirSync(widgetsDir, { withFileTypes: true });
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const type = entry.name;
    const widgetDir = path.join(widgetsDir, type);
    const source = exts
      .map(ext => path.join(widgetDir, `widget.${ext}`))
      .find(file => fs.existsSync(file));
    if (!source) continue;

    const target = path.join(controllersDir, `${type}.ts`);
    const header = '// AUTO-GENERATED FROM widgets; edit the source in widgets/<type>/widget.*\n';
    const content = fs.readFileSync(source, 'utf-8');
    fs.writeFileSync(target, `${header}${content}`);
    copied++;
  }
  return copied;
}

const count = copyControllers();
console.log(`Synced ${count} widget controller(s) to web/src/controllers`);
