// Use the same font-independent vector identity in the site and exported cards.
let logoPromise;

function loadLogo() {
  if (!logoPromise) {
    logoPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        logoPromise = null;
        reject(new Error('The Passiko logo could not be loaded. Try exporting again.'));
      };
      image.src = new URL('../assets/passiko-logo.svg', import.meta.url).href;
    });
  }
  return logoPromise;
}

export async function drawBrand(context, x, y, width = 210) {
  const logo = await loadLogo();
  context.drawImage(logo, x, y, width, width * logo.naturalHeight / logo.naturalWidth);
}
