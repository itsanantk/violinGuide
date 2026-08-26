import { TIP_GROUPS, allTips } from '../data/tips.js';
import { h, $, $$, esc } from '../ui/dom.js';

export function render(container) {
  container.appendChild(h(`
    <header>
      <span class="eyebrow">Tips</span>
      <h1>Advice</h1>
      <p>Written for someone working without a teacher. Each one says what to do and,
         more usefully, why it matters — so you can tell when it applies to you.</p>
    </header>
  `));

  const random = h(`
    <div class="card" style="border-color:var(--varnish)">
      <span class="eyebrow">One thing for today</span>
      <div data-random></div>
      <button class="btn small ghost" type="button" data-shuffle style="margin-top:.75rem">
        Show me another
      </button>
    </div>
  `);
  container.appendChild(random);

  const randomBody = $(random, '[data-random]');
  const pool = allTips();

  function shuffle() {
    const tip = pool[Math.floor(Math.random() * pool.length)];
    randomBody.replaceChildren(h(`
      <div>
        <h3 style="margin-bottom:.35rem">${esc(tip.title)}</h3>
        <p style="margin-bottom:.5rem">${esc(tip.body)}</p>
        <p class="small muted" style="margin:0"><b>Why:</b> ${esc(tip.why)}</p>
        <p class="small muted" style="margin:.5rem 0 0;opacity:.7">${esc(tip.group)}</p>
      </div>
    `));
  }
  $(random, '[data-shuffle]').addEventListener('click', shuffle);
  shuffle();

  const nav = h(`
    <nav class="row" style="margin:2rem 0 1.5rem" aria-label="Tip categories">
      ${TIP_GROUPS.map((g) => `<a class="btn small ghost" href="#tip-${g.id}">${esc(g.title)}</a>`).join('')}
    </nav>
  `);
  container.appendChild(nav);

  for (const group of TIP_GROUPS) {
    container.appendChild(h(`
      <section id="tip-${esc(group.id)}" style="margin-bottom:2.5rem">
        <h2>${esc(group.title)}</h2>
        <p class="muted" style="margin-bottom:1.25rem">${esc(group.blurb)}</p>
        <div class="stack">
          ${group.tips.map((tip) => `
            <article class="card">
              <h3>${esc(tip.title)}</h3>
              <p>${esc(tip.body)}</p>
              <p class="small muted" style="margin:0"><b>Why:</b> ${esc(tip.why)}</p>
            </article>`).join('')}
        </div>
      </section>
    `));
  }

  // Smooth in-page jumps without leaving a hash that the router would try to match.
  $$(nav, 'a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = container.querySelector(`#${CSS.escape(link.getAttribute('href').slice(1))}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  return () => {};
}
