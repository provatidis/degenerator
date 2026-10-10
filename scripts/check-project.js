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
const dependencies = new Map();
for (const file of files.filter(file => file.endsWith('.js'))) {
  const source = await readFile(file, 'utf8');
  dependencies.set(file, []);
  const path = relative(root, file).replaceAll('\\', '/');
  const layer = path.split('/')[0];
  const imports = [...source.matchAll(/(?:import|export)\s+[^;]*?\sfrom\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const specifier of imports) {
    assert.ok(specifier.startsWith('.') && specifier.endsWith('.js'), path + ': use local explicit module paths.');
    const target = resolve(dirname(file), specifier);
    assert.ok(relative(root, target) && !relative(root, target).startsWith('..'), path + ': imports must stay inside public/.');
    await access(target);
    dependencies.get(file).push(target);
    const targetLayer = relative(root, target).replaceAll('\\', '/').split('/')[0];
    if (layer === 'models') assert.equal(targetLayer, 'models', path + ': calculation models may only depend on models.');
    if (['data', 'lib'].includes(layer)) assert.ok(['data', 'models', 'lib'].includes(targetLayer), path + ': domain and utility modules must not depend on UI.');
    if (layer === 'ui') assert.notEqual(targetLayer, 'ui', path + ': compose UI controllers through main.js and injected interfaces.');
  }
  if (['models', 'data'].includes(layer)) assert.doesNotMatch(source, /\b(?:document|window)\s*\./, path + ': keep DOM code in UI.');
  if (layer === 'models') assert.doesNotMatch(source, /\bfetch\s*\(/, path + ': calculation models must not read the network.');
}
const visited = new Set(), active = new Set();
function visit(file, path = []) {
  assert.ok(!active.has(file), 'Circular module dependency: ' + [...path, file].map(value => relative(root, value)).join(' → '));
  if (visited.has(file)) return;
  active.add(file);
  for (const target of dependencies.get(file) || []) visit(target, [...path, file]);
  active.delete(file); visited.add(file);
}
for (const file of dependencies.keys()) visit(file);
for (const file of files.filter(file => file.endsWith('.css'))) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/@import\s+url\(["']([^"']+)["']\)/g)) await access(resolve(dirname(file), match[1]));
}
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
assert.ok(canonical, 'Publish the preferred homepage URL.');
const site = new URL(canonical);
assert.equal(site.protocol, 'https:');
assert.ok(site.pathname.endsWith('/'));
async function checkAsset(source) {
  const url = new URL(source, site);
  if (url.origin !== site.origin) return;
  assert.ok(url.pathname.startsWith(site.pathname), 'Asset must stay in the published project path: ' + source);
  const path = resolve(root, decodeURIComponent(url.pathname.slice(site.pathname.length)));
  assert.ok(!relative(root, path).startsWith('..'));
  await access(path);
}
for (const document of ['index.html', '404.html']) {
  const markup = await readFile(resolve(root, document), 'utf8');
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, document + ': HTML IDs must be unique.');
  for (const tag of markup.matchAll(/<(?:link|script|img)\b[^>]*>/g)) {
    const source = tag[0].match(/(?:href|src)="([^"]+)"/)?.[1];
    if (source && !tag[0].includes('rel="canonical"')) await checkAsset(source);
  }
}
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map(match => match[1]);
assert.deepEqual(scripts, ['main.js'], 'Compose startup through one entry point.');
const metadata = Object.fromEntries([...html.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)"/g)].map(match => [match[1], match[2]]));
for (const field of ['description','og:title','og:description','og:image:alt','twitter:title','twitter:description','twitter:image:alt']) assert.ok(metadata[field]?.trim(), 'Missing identity metadata: ' + field);
assert.equal(metadata['og:url'],canonical);
assert.equal(metadata['og:type'],'website');
assert.equal(metadata['twitter:card'],'summary_large_image');
assert.equal(metadata['twitter:image'],metadata['og:image']);
await checkAsset(metadata['og:image']);
const social = await readFile(resolve(root, new URL(metadata['og:image']).pathname.slice(site.pathname.length)));
function pngSize(bytes) {
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Use an actual PNG file.');
  return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}
assert.deepEqual(pngSize(social),[Number(metadata['og:image:width']),Number(metadata['og:image:height'])]);
assert.deepEqual(pngSize(await readFile(resolve(root,'assets/apple-touch-icon.png'))),[180,180]);
const manifest = JSON.parse(await readFile(resolve(root,'site.webmanifest'),'utf8'));
assert.equal(new URL(manifest.id,site).href,canonical);
assert.equal(new URL(manifest.start_url,site).href,canonical);
assert.equal(new URL(manifest.scope,site).href,canonical);
for (const icon of manifest.icons) {
  await checkAsset(icon.src);
  assert.deepEqual(pngSize(await readFile(resolve(root,icon.src))),icon.sizes.split('x').map(Number));
  assert.ok(icon.purpose.split(' ').includes('maskable'));
}
const ico = await readFile(resolve(root,'favicon.ico'));
assert.equal(ico.readUInt16LE(0),0);
assert.equal(ico.readUInt16LE(2),1);
assert.equal(ico.readUInt16LE(4),3);
for(let i=0;i<3;i++){
  const offset=6+i*16;
  assert.equal(ico[offset],[16,32,48][i]);
  assert.equal(ico[offset+1],ico[offset]);
  assert.ok(ico.readUInt32LE(offset+12)+ico.readUInt32LE(offset+8)<=ico.length);
}
assert.match(html,/<a class="skip-link" href="#main-content">/);
assert.match(html,/<main id="main-content" tabindex="-1">/);
assert.match(html,/<noscript>/);
console.log('PASS: module boundaries, assets, metadata, icon dimensions, manifest scope and accessible entry points');
