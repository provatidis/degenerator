import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(resolve(directory, entry.name)) : [resolve(directory, entry.name)]));
  return groups.flat();
}
const files = await filesIn(root);
for (const file of files.filter(file => file.endsWith('.js'))) {
  const source = await readFile(file, 'utf8');
  const path = relative(root, file).replaceAll('\\', '/');
  const layer = path.split('/')[0];
  const imports = [...source.matchAll(/(?:import|export)\s+[^;]*?\sfrom\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const specifier of imports) {
    assert.ok(specifier.startsWith('.') && specifier.endsWith('.js'), path + ': use local explicit module paths.');
    const target = resolve(dirname(file), specifier);
    assert.ok(relative(root, target) && !relative(root, target).startsWith('..'), path + ': imports must stay inside public/.');
    await access(target);
    const targetLayer = relative(root, target).replaceAll('\\', '/').split('/')[0];
    if (layer === 'models') assert.equal(targetLayer, 'models', path + ': calculation models may only depend on models.');
    if (['data', 'lib'].includes(layer)) assert.ok(['data', 'models', 'lib'].includes(targetLayer), path + ': domain and utility modules must not depend on UI.');
    if (layer === 'ui') assert.notEqual(targetLayer, 'ui', path + ': compose UI controllers through main.js and injected interfaces.');
  }
  if (['models', 'data'].includes(layer)) assert.doesNotMatch(source, /\b(?:document|window)\s*\./, path + ': keep DOM code in UI.');
  if (layer === 'models') assert.doesNotMatch(source, /\bfetch\s*\(/, path + ': calculation models must not read the network.');
}
for (const file of files.filter(file => file.endsWith('.css'))) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/@import\s+url\(["']([^"']+)["']\)/g)) await access(resolve(dirname(file), match[1]));
}
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique across all labs.');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map(match => match[1]);
assert.deepEqual(scripts, ['main.js'], 'Compose startup through one entry point.');
for (const source of [...scripts, ...[...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(match => match[1])]) await access(resolve(root, source));
console.log('PASS: local module paths, layer boundaries, styles, unique IDs and one application entry point');
