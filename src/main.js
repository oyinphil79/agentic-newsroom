import './style.css';
import { loadSettings, saveSettings } from './lib/settings.js';
import { runResearchAgent } from './agents/research.js';
import { PLATFORMS, runPlatformAgent } from './agents/platforms.js';

const $ = (sel) => document.querySelector(sel);
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const state = {
  settings: loadSettings(),
  ideas: [],
  selected: new Set(),
  approved: [],
  platform: {}, // key -> { status: 'idle'|'running'|'done'|'error', data, error }
  activeTab: 'facebook',
  busy: false,
};

/* ---------------- Settings ---------------- */
const dialog = $('#settings');
const form = $('#settings-form');

function openSettings() {
  for (const [k, v] of Object.entries(state.settings)) {
    const el = form.elements[k];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
  }
  dialog.showModal();
}

dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'save') return;
  state.settings = {
    openaiKey: form.elements.openaiKey.value.trim(),
    serpKey: form.elements.serpKey.value.trim(),
    model: form.elements.model.value.trim() || 'gpt-6.1-sol',
    remember: form.elements.remember.checked,
  };
  saveSettings(state.settings);
  renderKeyStatus();
});

function renderKeyStatus() {
  const { openaiKey, serpKey, model } = state.settings;
  const ok = openaiKey && serpKey;
  const el = $('#key-status');
  el.className = `pill ${ok ? 'ok' : 'warn'}`;
  el.textContent = ok ? `Keys set · ${model}` : 'API keys needed';
}

function requireKeys() {
  if (state.settings.openaiKey && state.settings.serpKey) return true;
  openSettings();
  return false;
}

$('#open-settings').addEventListener('click', openSettings);

/* ---------------- Pipeline indicator ---------------- */
function setStep(n) {
  document.querySelectorAll('#pipeline li').forEach((li) => {
    const s = Number(li.dataset.step);
    li.classList.toggle('done', s < n);
    li.classList.toggle('active', s === n);
  });
}

/* ---------------- Step 1: Research ---------------- */
function researchStatus(text, kind = 'info') {
  const el = $('#research-status');
  el.hidden = !text;
  el.className = `status ${kind}`;
  el.innerHTML = kind === 'info' ? `<span class="spinner"></span>${esc(text)}` : esc(text);
}

async function research({ withFeedback = false } = {}) {
  if (state.busy || !requireKeys()) return;
  state.busy = true;
  setBusyButtons();
  setStep(1);
  try {
    const { ideas, articles } = await runResearchAgent({
      settings: state.settings,
      feedback: withFeedback ? $('#research-feedback').value.trim() : '',
      previousIdeas: withFeedback ? state.ideas : [],
      onStatus: (t) => researchStatus(t),
    });
    state.ideas = ideas;
    state.selected.clear();
    researchStatus(`Done — 10 ideas from ${articles.length} fresh articles. Awaiting your review.`, 'success');
    $('#step-review').hidden = false;
    renderIdeas();
    setStep(2);
    $('#step-review').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    researchStatus(err.message, 'error');
  } finally {
    state.busy = false;
    setBusyButtons();
  }
}

$('#run-research').addEventListener('click', () => research());
$('#regenerate').addEventListener('click', () => research({ withFeedback: true }));

/* ---------------- Step 2: Human review ---------------- */
function renderIdeas() {
  $('#ideas').innerHTML = state.ideas
    .map((idea, i) => {
      const sel = state.selected.has(i);
      const sources = list(idea.sources)
        .slice(0, 3)
        .map((s) => `<a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title || 'source')}</a>`)
        .join('');
      return `
      <article class="idea ${sel ? 'selected' : ''}" data-index="${i}" tabindex="0" role="button" aria-pressed="${sel}">
        <div class="idea-top">
          <span class="idea-num">${i + 1}</span>
          ${idea.angle ? `<span class="tag">${esc(idea.angle)}</span>` : ''}
          ${idea.engagement_score ? `<span class="score" title="Predicted engagement">🔥 ${esc(idea.engagement_score)}/10</span>` : ''}
          <span class="check-mark">${sel ? '✓' : ''}</span>
        </div>
        <h3>${esc(idea.title)}</h3>
        <p class="hook">“${esc(idea.hook)}”</p>
        <p>${esc(idea.summary)}</p>
        ${idea.why_now ? `<p class="muted small"><strong>Why now:</strong> ${esc(idea.why_now)}</p>` : ''}
        ${sources ? `<div class="sources">${sources}</div>` : ''}
      </article>`;
    })
    .join('');
  $('#selection-count').textContent = `${state.selected.size} / 3 selected`;
  $('#selection-count').className = `pill ${state.selected.size === 3 ? 'ok' : ''}`;
  setBusyButtons();
}

function toggleIdea(i) {
  if (state.selected.has(i)) state.selected.delete(i);
  else if (state.selected.size < 3) state.selected.add(i);
  renderIdeas();
}

$('#ideas').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const card = e.target.closest('.idea');
  if (card) toggleIdea(Number(card.dataset.index));
});
$('#ideas').addEventListener('keydown', (e) => {
  const card = e.target.closest('.idea');
  if (card && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    toggleIdea(Number(card.dataset.index));
  }
});

function setBusyButtons() {
  $('#run-research').disabled = state.busy;
  $('#regenerate').disabled = state.busy;
  $('#approve').disabled = state.busy || state.selected.size !== 3;
  const anyDone = Object.values(state.platform).some((p) => p.status === 'done');
  $('#download').disabled = !anyDone;
}

/* ---------------- Step 3: Platform agents (parallel) ---------------- */
$('#approve').addEventListener('click', async () => {
  if (state.selected.size !== 3 || !requireKeys()) return;
  state.approved = [...state.selected].sort((a, b) => a - b).map((i) => state.ideas[i]);
  $('#step-content').hidden = false;
  setStep(3);
  $('#step-content').scrollIntoView({ behavior: 'smooth', block: 'start' });

  state.busy = true;
  setBusyButtons();
  await Promise.allSettled(Object.keys(PLATFORMS).map(runPlatform));
  state.busy = false;
  setBusyButtons();
});

async function runPlatform(key) {
  state.platform[key] = { status: 'running' };
  renderContent();
  try {
    const data = await runPlatformAgent({
      platform: key,
      settings: state.settings,
      ideas: state.approved,
      notes: $('#platform-notes').value.trim(),
    });
    state.platform[key] = { status: 'done', data };
  } catch (err) {
    state.platform[key] = { status: 'error', error: err.message };
  }
  renderContent();
  setBusyButtons();
}

const STATUS_ICON = { running: '<span class="spinner"></span>', done: '✓', error: '⚠', idle: '' };

function renderContent() {
  $('#tabs').innerHTML = Object.entries(PLATFORMS)
    .map(([key, cfg]) => {
      const st = state.platform[key]?.status || 'idle';
      return `<button class="tab ${key} ${state.activeTab === key ? 'active' : ''}" data-tab="${key}">
        ${esc(cfg.name)} <span class="tab-status ${st}">${STATUS_ICON[st]}</span></button>`;
    })
    .join('');

  const key = state.activeTab;
  const p = state.platform[key] || { status: 'idle' };
  const out = $('#platform-output');
  if (p.status === 'running') {
    out.innerHTML = `<div class="status info"><span class="spinner"></span>${esc(PLATFORMS[key].agent)} is writing content for your 3 ideas…</div>`;
  } else if (p.status === 'error') {
    out.innerHTML = `<div class="status error">${esc(p.error)}</div>
      <button class="btn ghost retry" data-retry="${key}">↻ Retry ${esc(PLATFORMS[key].name)} Agent</button>`;
  } else if (p.status === 'done') {
    out.innerHTML = RENDERERS[key](p.data);
  } else {
    out.innerHTML = '';
  }
}

$('#tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (!tab) return;
  state.activeTab = tab.dataset.tab;
  renderContent();
});

$('#platform-output').addEventListener('click', async (e) => {
  const retry = e.target.closest('[data-retry]');
  if (retry) return runPlatform(retry.dataset.retry);
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const text = copy.closest('.piece').querySelector('.copy-src').innerText;
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied!';
    } catch {
      copy.textContent = 'Copy failed';
    }
    setTimeout(() => (copy.textContent = 'Copy'), 1500);
  }
});

/* ---------------- Renderers ---------------- */
const tags = (h) => list(h).map((t) => (String(t).startsWith('#') ? t : `#${t}`)).join(' ');
const piece = (title, body) => `
  <div class="piece">
    <div class="piece-head"><h3>${esc(title)}</h3><button class="btn tiny" data-copy>Copy</button></div>
    <div class="copy-src">${body}</div>
  </div>`;
const line = (label, value) => (value ? `<p><strong>${label}:</strong> ${esc(value)}</p>` : '');

const RENDERERS = {
  facebook: (d) =>
    list(d.posts)
      .map((p, i) =>
        piece(
          `Idea ${i + 1}: ${p.idea_title || state.approved[i]?.title || ''}`,
          `<p class="lead">${esc(p.headline)}</p>
           <p class="pre">${esc(p.post)}</p>
           ${line('💬 Ask', p.engagement_question)}
           ${line('👉 CTA', p.cta)}
           <p class="hashtags">${esc(tags(p.hashtags))}</p>
           ${line('🖼 Visual', p.visual_suggestion)}`
        )
      )
      .join(''),

  tiktok: (d) =>
    list(d.videos)
      .map((v, i) =>
        piece(
          `Idea ${i + 1}: ${v.idea_title || state.approved[i]?.title || ''}`,
          `<p class="lead">🎬 Hook: ${esc(v.hook)}</p>
           ${line('⏱ Duration', v.duration)}
           <table class="script"><thead><tr><th>Time</th><th>Voiceover</th><th>On screen</th></tr></thead><tbody>
           ${list(v.script)
             .map((s) => `<tr><td>${esc(s.time)}</td><td>${esc(s.voiceover)}</td><td>${esc(s.on_screen)}</td></tr>`)
             .join('')}
           </tbody></table>
           ${line('📝 Caption', v.caption)}
           <p class="hashtags">${esc(tags(v.hashtags))}</p>
           ${line('🎵 Sound', v.sound_suggestion)}
           ${line('👉 CTA', v.cta)}`
        )
      )
      .join(''),

  instagram: (d) =>
    list(d.posts)
      .map((p, i) =>
        piece(
          `Idea ${i + 1}: ${p.idea_title || state.approved[i]?.title || ''}`,
          `<div class="carousel">
             ${list(p.carousel)
               .map(
                 (s, j) => `<div class="slide"><span class="slide-num">${esc(s.slide ?? j + 1)}</span>
                   <p>${esc(s.text)}</p><p class="muted small">${esc(s.visual)}</p></div>`
               )
               .join('')}
           </div>
           <p class="pre">${esc(p.caption)}</p>
           <p class="hashtags">${esc(tags(p.hashtags))}</p>
           ${line('🎞 Reel idea', p.reel_idea)}
           ${line('♿ Alt text', p.alt_text)}`
        )
      )
      .join(''),
};

/* ---------------- Markdown export ---------------- */
function toMarkdown() {
  let md = `# AI News Content Pack — ${new Date().toDateString()}\n\n## Approved ideas\n`;
  state.approved.forEach((idea, i) => {
    md += `\n${i + 1}. **${idea.title}** — ${idea.hook}\n`;
  });
  for (const [key, cfg] of Object.entries(PLATFORMS)) {
    const p = state.platform[key];
    if (p?.status !== 'done') continue;
    md += `\n---\n\n## ${cfg.name}\n`;
    const items = list(p.data.posts || p.data.videos);
    items.forEach((it, i) => {
      md += `\n### Idea ${i + 1}: ${it.idea_title || state.approved[i]?.title || ''}\n\n`;
      if (key === 'facebook') {
        md += `**${it.headline}**\n\n${it.post}\n\n💬 ${it.engagement_question}\n\n👉 ${it.cta}\n\n${tags(it.hashtags)}\n\n_Visual:_ ${it.visual_suggestion}\n`;
      } else if (key === 'tiktok') {
        md += `**Hook:** ${it.hook}  \n**Duration:** ${it.duration}\n\n| Time | Voiceover | On screen |\n|---|---|---|\n`;
        list(it.script).forEach((s) => (md += `| ${s.time} | ${s.voiceover} | ${s.on_screen} |\n`));
        md += `\n**Caption:** ${it.caption}\n\n${tags(it.hashtags)}\n\n_Sound:_ ${it.sound_suggestion}  \n_CTA:_ ${it.cta}\n`;
      } else {
        list(it.carousel).forEach((s, j) => (md += `- **Slide ${s.slide ?? j + 1}:** ${s.text} _(${s.visual})_\n`));
        md += `\n${it.caption}\n\n${tags(it.hashtags)}\n\n_Reel idea:_ ${it.reel_idea}\n\n_Alt text:_ ${it.alt_text}\n`;
      }
    });
  }
  return md;
}

$('#download').addEventListener('click', () => {
  const blob = new Blob([toMarkdown()], { type: 'text/markdown' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `ai-content-pack-${new Date().toISOString().slice(0, 10)}.md`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------------- Init ---------------- */
renderKeyStatus();
setStep(1);
if (!state.settings.openaiKey || !state.settings.serpKey) openSettings();
