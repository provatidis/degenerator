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
// Teaching text and grading must update together. These modules are pure or editorial;
// protocol adapters and RPC classes retain their shared, unversioned module identity.
const teaching = {
  'ui/learning.js': ['../learning/liquidity-essentials.js', '../learning/deeper-reading.js', '../lib/lesson-walkthrough.js', '../lib/lesson-narration.js', '../models/lesson-experiments.js', '../models/lesson-application.js', '../lib/lesson-application-copy.js', '../lib/learning-choices.js', '../data/learning-progress.js', '../lib/management-links.js', '../lib/learning-elements.js', '../learning/pool-pitfalls.js'],
  'ui/applied-learning.js': ['../learning/applied-liquidity.js', '../lib/applied-lessons.js', '../lib/applied-applications.js', '../lib/learning-choices.js', '../data/applied-progress.js', '../lib/learning-elements.js', '../learning/pool-pitfalls.js'],
  'ui/management-learning.js': ['../learning/choosing-ranges.js', '../models/range-decisions.js', '../lib/management-links.js', '../data/management-progress.js', '../lib/learning-choices.js', '../lib/learning-elements.js'],
  'data/management-progress.js': ['../models/range-decisions.js', '../lib/learning-choices.js'],
  'lib/management-links.js': ['../models/range-decisions.js'],
  'lib/learning-elements.js': ['./learning-choices.js'],
  'data/learning-progress.js': ['../models/lesson-experiments.js', '../lib/learning-choices.js'],
  'data/applied-progress.js': ['../lib/applied-lessons.js', '../lib/learning-choices.js'],
  'models/lesson-application.js': ['./lesson-experiments.js'],
  'lib/lesson-application-copy.js': ['../models/lesson-application.js'],
  'models/lesson-experiments.js': ['./learning-answer.js'],
  'lib/applied-lessons.js': ['../models/learning-answer.js'],
};
for (const [name, imports] of Object.entries(teaching)) {
  const file = new URL(name, root), source = await readFile(file, 'utf8');
  await writeFile(file, source.replace(/(from ['"])([^'"]+)(['"])/g, (match, before, path, after) =>
    imports.includes(path.split('?')[0]) ? before + stamp(path) + after : match));
}
for (const name of ['index.html', 'learn.html', 'about.html', 'methods.html', '404.html']) {
  const file = new URL(name, root);
  const source = await readFile(file, 'utf8');
  await writeFile(file, source.replace(/((?:href|src)=["])([^"]+)(["])/g, (match, before, path, after) => {
    const plain = path.split('?')[0];
    return /(?:\.css|(?:^|\/)(?:learn-)?main\.js)$/.test(plain) ? before + stamp(path) + after : match;
  }));
}
const styles = [new URL('styles.css', root), ...(await readdir(new URL('styles/', root))).filter(name => name.endsWith('.css')).map(name => new URL('styles/' + name, root))];
for (const file of styles) {
  const source = await readFile(file, 'utf8');
  const updated = source.replace(/(@import url\(["])([^"?]+)(?:\?[^"\)]*)?(["]\);)/g, (_, before, path, after) => before + stamp(path) + after);
  if (updated !== source) await writeFile(file, updated);
}
console.log('Stamped page entries, UI controllers, teaching modules and stylesheet imports for ' + version + '.');
