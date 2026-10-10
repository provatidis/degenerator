// The app uses fragments for shared scenarios; keyboard navigation must preserve them.
export function initPageAccess() {
  const skip = document.querySelector('.skip-link');
  const content = document.getElementById('main-content');
  skip.addEventListener('click', event => {
    event.preventDefault();
    content.focus({ preventScroll: true });
    content.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
}
