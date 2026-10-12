import { readdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../public/', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Use a numeric release version.');
const stamp = path => path.split('?')[0] + '?v=' + version;

for (const name of ['main.js', 'learn-main.js']) {
  const file = new URL(name, root);
  const source = await readFile(file, 'utf8');
  await writeFile(file, source.replace(/(from ['"])(\.\/ui\/[^'"]+)(['"])/g, (_, before, path, after) => before + stamp(path) + after));
}
for (const name of ['index.html', 'learn.html', '404.html']) {
  const file = new URL(name, root);
  const source = await readFile(file, 'utf8');
  await writeFile(file, source.replace(/((?:href|src)=["])([^"]+)(["])/g, (match, before, path, after) => {
    const plain = path.split('?')[0];
    return /(?:^|\/)(?:styles\.css|styles\/errors\.css|(?:learn-)?main\.js)$/.test(plain) ? before + stamp(path) + after : match;
  }));
}
const styles = [new URL('styles.css', root), ...(await readdir(new URL('styles/', root))).filter(name => name.endsWith('.css')).map(name => new URL('styles/' + name, root))];
for (const file of styles) {
  const source = await readFile(file, 'utf8');
  const updated = source.replace(/(@import url\(["])([^"?]+)(?:\?[^"\)]*)?(["]\);)/g, (_, before, path, after) => before + stamp(path) + after);
  if (updated !== source) await writeFile(file, updated);
}
console.log('Stamped page entries, UI controllers and stylesheet imports for ' + version + '.');
