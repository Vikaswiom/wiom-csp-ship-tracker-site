// Minimal stand-in for the claude.ai Data-artifact runtime so page/index.html runs on GitHub Pages.
// Provides window.dash (data, calc, draw, onData, params, setParams, setLink, colors) over static JSON files.
(function () {
  const DATASETS = {
    release_metrics: 'data/release_metrics.json',
    release_steps: 'data/release_steps.json',
    releases: 'data/releases.json',
    targets: 'data/targets.json',
    spec: 'data/spec.json',
    metrics: 'data/metrics.json'
  };
  const raw = {}, calcs = {}, memo = {}, draws = [], onDatas = [];
  let loaded = false, params = {};
  try { params = JSON.parse(sessionStorage.getItem('ship-params') || '{}'); } catch (e) { params = {}; }
  const defaults = { release: 'stv', metric: 'unaided', wave: 'all' };
  for (const k in defaults) if (params[k] == null) params[k] = defaults[k];

  const rowsOf = (j) => (Array.isArray(j) ? j : j && Array.isArray(j.rows) ? j.rows : j && Array.isArray(j.data) ? j.data : []);
  function data(id) {
    if (calcs[id]) {
      if (!loaded) return { status: 'loading', data: null };
      if (!(id in memo)) {
        const c = calcs[id];
        const ins = c.inputs.map((i) => { const d = data(i); return d.data == null ? [] : d.data; });
        try { memo[id] = c.fn(...ins); } catch (e) { console.error('calc', id, e); memo[id] = []; }
      }
      return { status: 'ok', data: memo[id] };
    }
    if (!loaded) return { status: 'loading', data: [] };
    if (!(id in raw)) return { status: 'missing', data: [] };
    return { status: 'ok', data: raw[id] };
  }
  const visible = (el) => { for (let n = el; n; n = n.parentElement) if (n.hidden) return false; return true; };
  let pending = false;
  function redraw() {
    if (pending) return; pending = true;
    requestAnimationFrame(() => {
      pending = false;
      for (const f of onDatas) { try { f(); } catch (e) { console.error(e); } }
      for (const d of draws) {
        document.querySelectorAll(`[data-draw="${d.name}"]`).forEach((el) => {
          if (!visible(el)) return;
          try {
            if (typeof d.fn === 'function') d.fn(el);
            else { if (!el.__made) { el.replaceChildren(); el.__made = d.fn.mount ? d.fn.mount(el) || {} : {}; } d.fn.update && d.fn.update(el, el.__made); }
          } catch (e) { console.error('draw', d.name, e); }
        });
      }
    });
  }
  const dash = {
    data, calc: (id, o) => { calcs[id] = o; },
    draw: (name, fn) => { if (fn) draws.push({ name, fn }); else redraw(); },
    onData: (fn) => { onDatas.push(fn); },
    loader: () => {}, refresh: () => {},
    params: () => ({ ...params }),
    setParams: (p) => { for (const k in p) { if (p[k] == null) delete params[k]; else params[k] = p[k]; } try { sessionStorage.setItem('ship-params', JSON.stringify(params)); } catch (e) {} redraw(); },
    resetParams: () => { params = { ...defaults }; redraw(); },
    setLink: (name) => { try { history.replaceState(null, '', '#' + name); } catch (e) {} },
    colors: ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)']
  };
  window.dash = dash;
  window.claude = { use: () => Promise.reject(new Error('Read-only copy')) };
  // redraw when tabs show/hide sections or the window resizes
  new MutationObserver(() => redraw()).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  let rt = null; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redraw, 150); });
  Promise.all(Object.entries(DATASETS).map(([id, url]) => fetch(url, { cache: 'no-cache' }).then((r) => r.json()).then((j) => { raw[id] = rowsOf(j); if (j && j.meta) raw[id + '__meta'] = j.meta; }).catch((e) => { console.error(url, e); raw[id] = []; })))
    .then(() => { loaded = true; const m = (raw.release_metrics__meta || []).find((x) => x.label === 'Data as of'); document.querySelectorAll('[data-asof]').forEach((n) => { n.textContent = m ? m.value : '—'; }); redraw(); });
  document.addEventListener('DOMContentLoaded', redraw);
})();
