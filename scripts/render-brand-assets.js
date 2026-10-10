// Optional maintainer tool. Uses Sharp to rasterize committed SVG sources;
// the website itself has no build step or runtime dependency.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { default: sharp } = await import(process.env.SHARP_MODULE || 'sharp');
const root = new URL('../public/', import.meta.url);
const favicon = await readFile(new URL('favicon.svg', root), 'utf8');
const opaque = favicon.replace('rx="16"', 'rx="0"');
await mkdir(new URL('assets/', root), { recursive: true });
for (const [name, size] of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]) {
  await sharp(Buffer.from(opaque)).resize(size,size).png().toFile(fileURLToPath(new URL('assets/' + name, root)));
}
const sizes = [16,32,48];
const frames = [];
for (const size of sizes) {
  const rgba = await sharp(Buffer.from(favicon)).resize(size,size).ensureAlpha().raw().toBuffer();
  const pixels = Buffer.alloc(size*size*4);
  const maskStride = Math.ceil(size/32)*4;
  const mask = Buffer.alloc(maskStride*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const source=(y*size+x)*4;
    const target=((size-1-y)*size+x)*4;
    pixels[target]=rgba[source+2];pixels[target+1]=rgba[source+1];pixels[target+2]=rgba[source];pixels[target+3]=rgba[source+3];
    if(rgba[source+3]===0)mask[(size-1-y)*maskStride+(x>>3)]|=1<<(7-(x%8));
  }
  const bitmap=Buffer.alloc(40);
  bitmap.writeUInt32LE(40,0);bitmap.writeInt32LE(size,4);bitmap.writeInt32LE(size*2,8);
  bitmap.writeUInt16LE(1,12);bitmap.writeUInt16LE(32,14);bitmap.writeUInt32LE(pixels.length+mask.length,20);
  frames.push(Buffer.concat([bitmap,pixels,mask]));
}
const directory=Buffer.alloc(6+sizes.length*16);
directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);
let offset=directory.length;
for(const [index,size] of sizes.entries()){
  const entry=6+index*16;
  directory[entry]=size;directory[entry+1]=size;
  directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);
  directory.writeUInt32LE(frames[index].length,entry+8);directory.writeUInt32LE(offset,entry+12);
  offset+=frames[index].length;
}
await writeFile(new URL('favicon.ico',root),Buffer.concat([directory,...frames]));
await sharp(await readFile(new URL('assets/social-preview.svg',root))).png().toFile(fileURLToPath(new URL('assets/social-preview.png',root)));
console.log('Rendered favicon, touch/app icons and the 1200×630 social preview.');
