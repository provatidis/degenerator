// The app uses fragments for shared scenarios; keyboard navigation must preserve them.
export function initPageAccess() {
  // Native anchors and scrollIntoView share the measured sticky-header offset.
  const header = document.querySelector('.topbar');
  const tabs = document.querySelector('.lab-switch');
  function refreshOffsets() {
    document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
    const height = tabs?.getBoundingClientRect().height;
    if (height) document.documentElement.style.setProperty('--lab-tabs-height', height + 'px');
  }
  refreshOffsets();
  const observer = new ResizeObserver(refreshOffsets);
  observer.observe(header);
  if (tabs) observer.observe(tabs);
  // SVG text scales with its viewBox. Keep labels at least 12 screen pixels
  // on narrow cards, including charts revealed after a workspace/tab switch.
  const charts = [...document.querySelectorAll('svg')].filter(chart => chart.querySelector('.chart-label'));
  const chartObserver = new ResizeObserver(entries => {
    for (const { target: chart, contentRect } of entries) {
      if (!contentRect.width) continue;
      const size = Math.max(12, 12 * chart.viewBox.baseVal.width / contentRect.width);
      chart.style.setProperty('--chart-label-size', size + 'px');
    }
  });
  for (const chart of charts) chartObserver.observe(chart);
  const skip = document.querySelector('.skip-link');
  const content = document.getElementById('main-content');
  skip.addEventListener('click', event => {
    event.preventDefault();
    content.focus({ preventScroll: true });
    content.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  return { refreshOffsets };
}
