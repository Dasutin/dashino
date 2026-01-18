import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const widgetsDir = path.join(repoRoot, 'widgets');
const controllersDir = path.join(repoRoot, 'web', 'src', 'controllers');
const generatedFile = path.join(controllersDir, 'generated.ts');

const exts = ['ts', 'tsx', 'js'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyControllers() {
  ensureDir(controllersDir);

  const entries = fs.readdirSync(widgetsDir, { withFileTypes: true });
  let copied = 0;
  const types = [];
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
    const raw = fs.readFileSync(source, 'utf-8');
    const content = rewriteImports(raw);
    fs.writeFileSync(target, `${header}${content}`);
    types.push(type);
    copied++;
  }
  generateIndex(types);
  return copied;
}

function rewriteImports(content) {
  // Ensure copied controllers import types from their new location under web/src/controllers
  return content.replace(/from\s+['"]\.\.\/\.\.\/web\/src\/types['"]/g, "from '../types'");
}

function generateIndex(types) {
  const lines = [];
  lines.push('// AUTO-GENERATED. Do not edit. Edit widgets/<type>/widget.* instead.');
  lines.push("import type { WidgetFactory } from '../types';");
  lines.push('');
  types.forEach(type => {
    lines.push(`import * as ${safeIdent(type)} from './${type}';`);
  });
  lines.push('');
  lines.push('function resolveFactory(mod: any): WidgetFactory | undefined {');
  lines.push("  if (typeof mod.createController === 'function') return mod.createController;");
  lines.push("  if (typeof mod.default === 'function') return mod.default;");
  lines.push("  const key = Object.keys(mod).find(k => /^create.+Controller$/.test(k));");
  lines.push('  if (key && typeof mod[key] === "function") return mod[key] as WidgetFactory;');
  lines.push('  return undefined;');
  lines.push('}');
  lines.push('');
  lines.push('const controllers: Record<string, WidgetFactory> = {');
  types.forEach(type => {
    lines.push(`  '${type}': resolveFactory(${safeIdent(type)}),`);
  });
  lines.push('};');
  lines.push('');
  lines.push('export default controllers;');

  fs.writeFileSync(generatedFile, lines.join('\n'));
}

function safeIdent(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

const count = copyControllers();
console.log(`Synced ${count} widget controller(s) to web/src/controllers`);
