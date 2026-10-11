// The app uses fragments for shared scenarios; keyboard navigation must preserve them.
export function initPageAccess() {
  // Native anchors and scrollIntoView share the measured sticky-header offset.
  const header = document.querySelector('.topbar');
  const measureHeader = () => document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
  measureHeader();
  const observer = new ResizeObserver(measureHeader);
  observer.observe(header);
  const skip = document.querySelector('.skip-link');
  const content = document.getElementById('main-content');
  skip.addEventListener('click', event => {
    event.preventDefault();
    content.focus({ preventScroll: true });
    content.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
}
