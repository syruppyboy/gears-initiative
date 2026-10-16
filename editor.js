// Gears Initiative visual editor.
// Loaded only when the site is opened with #edit. Visitors never download it.
// Changes are saved by committing index.html (and uploaded photos) to GitHub,
// which requires the owner's access key — stored only in the owner's browser.
(() => {
  'use strict';

  // ---------- Config ----------
  const REPO = (() => {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (m) {
      const first = location.pathname.split('/').filter(Boolean)[0];
      const repo = first && !first.includes('.') ? first : `${m[1]}.github.io`;
      return { owner: m[1], repo };
    }
    return { owner: 'syruppyboy', repo: 'gears-initiative' };
  })();
  const TOKEN_KEY = 'gears-editor-token';
  const PAGES = [['home','Home'],['lessons','Lessons'],['about','About'],['impact','Stories'],['donate','Donate'],['contact','Contact']];
  const PRESETS = [['Terracotta','#C75D3A'],['Teal','#2F7F7A'],['Plum','#8A4F7D'],['Forest','#4F7A3F'],['Ocean','#2F5F98'],['Marigold','#B07A1E']];
  const HEAD_FONTS = ['Newsreader','Fraunces','Playfair Display','Lora','DM Serif Display','Merriweather','Libre Baskerville'];
  const BODY_FONTS = ['Hanken Grotesk','Inter','DM Sans','Work Sans','Nunito','Source Sans 3','Lato'];
  const NEW_ITEMS = {
    courses: () => ({ id: 'course-' + Date.now().toString(36), title: 'New course', track: 'Topic', level: 'Beginner',
      instructor: 'Instructor name', blurb: 'Describe what students will build in this course.',
      lessons: [{ t: 'Lesson 1', d: '5 min' }] }),
    lessons: () => ({ t: 'New lesson', d: '5 min' }),
    team: () => ({ name: 'Name', role: 'Role' }),
    stories: () => ({ quote: 'What did this course mean to you?', name: 'Name, age', place: 'City, Country', course: 'Course name' })
  };

  let token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
  let dirty = false;
  const pending = new Map(); // repo path -> base64 data for photos not yet published

  const PLAIN = (() => { const d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; })();

  // ---------- Styles ----------
  const css = `
  body.editing{padding-bottom:96px}
  body.editing [data-edit]{outline:1.5px dashed color-mix(in srgb,var(--accent) 45%,transparent);outline-offset:3px;border-radius:3px;cursor:text;transition:outline-color .15s}
  body.editing [data-edit]:hover{outline-color:var(--accent)}
  body.editing [data-edit]:focus{outline:2px solid var(--accent);background:color-mix(in srgb,var(--accent-soft) 60%,transparent)}
  body.editing button [data-edit],body.editing button[data-edit]{cursor:pointer}
  body.editing [data-img]{cursor:pointer;position:relative}
  body.editing [data-img]::after{content:'📷 Change photo';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(36,31,27,.82);color:#fff;font:600 13px var(--font-body);padding:8px 14px;border-radius:999px;opacity:0;transition:opacity .15s;pointer-events:none;white-space:nowrap}
  body.editing .story-avatar[data-img]::after{content:'📷';padding:6px;font-size:14px}
  body.editing [data-img]:hover::after{opacity:1}
  body.editing [data-img]:hover{box-shadow:inset 0 0 0 2px var(--accent)}
  .ed-ctl{position:absolute;z-index:5;font:600 12px var(--font-body);border-radius:999px;cursor:pointer;user-select:none}
  .ed-del{top:-10px;right:-10px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#fff;color:#a33;border:1px solid #e6cfc8;font-size:17px;box-shadow:0 4px 10px rgba(0,0,0,.08)}
  .ed-del:hover{background:#a33;color:#fff}
  .lesson-row{position:relative}
  .lesson-row .ed-del{position:static;flex-shrink:0;width:24px;height:24px;font-size:15px;box-shadow:none}
  .ed-open{left:14px;bottom:14px;background:var(--accent);color:#fff;padding:7px 13px}
  .course-card .ed-open{position:static;align-self:flex-start;margin:0 22px 20px}
  .ed-add{font:600 15px var(--font-body);color:var(--accent-deep);background:transparent;border:2px dashed color-mix(in srgb,var(--accent) 50%,transparent);border-radius:18px;cursor:pointer;min-height:120px}
  .ed-add:hover{background:var(--accent-soft)}
  .ed-add-row{width:100%;min-height:0;padding:12px;margin-top:6px;border-radius:12px;font-size:14px}
  #ed-video-btn{display:inline-flex;align-items:center;gap:8px;margin:0 0 14px;background:#241F1B;color:#fff;border:none;border-radius:999px;padding:10px 18px;font:600 14px var(--font-body);cursor:pointer}
  #ed-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:1000;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;background:#241F1B;color:#F4EEE6;padding:8px;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.28);font:500 14px var(--font-body);max-width:calc(100vw - 24px)}
  #ed-bar .ed-badge{display:flex;align-items:center;gap:7px;padding:0 10px 0 8px;font-weight:600}
  #ed-bar .ed-dot{width:8px;height:8px;border-radius:50%;background:#7FD18B}
  #ed-bar.dirty .ed-dot{background:#F2B544}
  #ed-bar select,#ed-bar button{font:600 14px var(--font-body);border-radius:12px;padding:9px 14px;border:1px solid #4a3f37;background:#332b26;color:#F4EEE6;cursor:pointer}
  #ed-bar button:hover,#ed-bar select:hover{background:#40362f}
  #ed-bar .ed-publish{background:var(--accent);border-color:var(--accent);color:#fff}
  #ed-bar .ed-publish:hover{background:var(--accent-deep)}
  #ed-bar .ed-publish[disabled]{opacity:.55;cursor:default;background:#332b26;border-color:#4a3f37}
  #ed-menu{position:fixed;z-index:1001;background:#fff;border:1px solid #ECE3D6;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.18);padding:6px;min-width:220px}
  #ed-menu button{display:block;width:100%;text-align:left;background:none;border:none;padding:11px 13px;border-radius:9px;font:500 14.5px var(--font-body);color:#2A2320;cursor:pointer}
  #ed-menu button:hover{background:#F5EDE3}
  .ed-modal-bg{position:fixed;inset:0;z-index:1002;background:rgba(36,31,27,.45);display:flex;align-items:center;justify-content:center;padding:16px}
  .ed-modal{background:#FAF6F0;color:#2A2320;border-radius:20px;padding:28px;width:100%;max-width:480px;max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.3);font:400 15px/1.55 var(--font-body)}
  .ed-modal h3{font:500 25px/1.2 var(--font-head);margin:0 0 8px}
  .ed-modal p{margin:0 0 14px;color:#6B5F56}
  .ed-modal ol{margin:0 0 16px;padding-left:20px;color:#4A3F37}
  .ed-modal li{margin-bottom:7px}
  .ed-modal a{color:var(--accent-deep);font-weight:600}
  .ed-modal code{background:#EFE6D9;padding:1px 6px;border-radius:5px;font-size:13.5px}
  .ed-modal input[type=text],.ed-modal input[type=password],.ed-modal input[type=url],.ed-modal select{width:100%;border:1px solid #E0D5C8;border-radius:11px;padding:12px 14px;font:400 15px var(--font-body);background:#fff;color:#2A2320;outline:none}
  .ed-modal input:focus,.ed-modal select:focus{border-color:var(--accent)}
  .ed-modal label{display:block;font-weight:600;font-size:14px;margin:14px 0 7px}
  .ed-row{display:flex;gap:10px;justify-content:flex-end;margin-top:22px;flex-wrap:wrap}
  .ed-btn{font:600 15px var(--font-body);padding:12px 20px;border-radius:999px;border:1px solid #E0D5C8;background:#fff;color:#2A2320;cursor:pointer}
  .ed-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
  .ed-btn.danger{color:#a33}
  .ed-btn[disabled]{opacity:.6;cursor:default}
  .ed-err{color:#a33;font-size:14px;margin-top:10px;min-height:1em}
  .ed-swatches{display:flex;gap:10px;flex-wrap:wrap}
  .ed-swatch{width:44px;height:44px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px #E0D5C8;cursor:pointer;padding:0}
  .ed-swatch.on{box-shadow:0 0 0 2px #2A2320}
  .ed-color{display:flex;align-items:center;gap:10px;margin-top:12px}
  .ed-color input{width:44px;height:44px;border:none;padding:0;background:none;cursor:pointer}
  #ed-toast{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:1003;background:#2A2320;color:#fff;padding:12px 18px;border-radius:12px;font:500 14.5px var(--font-body);box-shadow:0 12px 30px rgba(0,0,0,.25);max-width:calc(100vw - 32px);text-align:center}
  #ed-toast a{color:#F6C9B5}
  @media (max-width:640px){#ed-bar{bottom:10px;border-radius:14px}#ed-bar .ed-badge span:last-child{display:none}#ed-bar select,#ed-bar button{padding:8px 11px}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- Small UI helpers ----------
  const h = (tag, attrs = {}, html = '') => { const el = document.createElement(tag); Object.assign(el, attrs); if (html) el.innerHTML = html; return el; };

  let toastTimer;
  function toast(html, ms = 3500) {
    let t = document.getElementById('ed-toast');
    if (!t) { t = h('div', { id: 'ed-toast' }); document.body.appendChild(t); }
    t.innerHTML = html;
    t.style.display = 'block';
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => { t.style.display = 'none'; }, ms);
  }

  function modal(html) {
    const bg = h('div', { className: 'ed-modal-bg' });
    const box = h('div', { className: 'ed-modal' }, html);
    bg.appendChild(box);
    const close = () => bg.remove();
    bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.body.appendChild(bg);
    const first = box.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { box, close, $: s => box.querySelector(s) };
  }

  function markDirty() {
    dirty = true;
    const bar = document.getElementById('ed-bar');
    if (bar) {
      bar.classList.add('dirty');
      bar.querySelector('.ed-status').textContent = 'Unpublished changes';
      bar.querySelector('.ed-publish').disabled = false;
    }
  }
  function markClean() {
    dirty = false;
    const bar = document.getElementById('ed-bar');
    bar.classList.remove('dirty');
    bar.querySelector('.ed-status').textContent = 'All changes published';
    bar.querySelector('.ed-publish').disabled = true;
  }

  // ---------- Turning edit mode on ----------
  EDIT.on = true;
  document.body.classList.add('editing');

  function decorate() {
    document.querySelectorAll('[data-edit]').forEach(el => {
      if (!el.closest('button') && !el.isContentEditable) {
        el.contentEditable = PLAIN;
        el.spellcheck = true;
      }
    });
    const pw = document.querySelector('#lessons-player.active .player-wrap > div:first-child');
    if (pw && !document.getElementById('ed-video-btn')) {
      const b = h('button', { id: 'ed-video-btn', type: 'button' }, '🎬 Set lesson video');
      b.onclick = editVideo;
      pw.insertBefore(b, pw.firstChild);
    }
    const sel = document.getElementById('ed-page');
    if (sel) sel.value = activeTab;
  }
  window.onSiteRender = decorate;

  // ---------- Text editing ----------
  document.addEventListener('input', e => {
    const el = e.target.closest && e.target.closest('[data-edit]');
    if (!el) return;
    setPath(el.dataset.edit, el.textContent.replace(/\s*\n\s*/g, ' '));
    markDirty();
  }, true);

  document.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('[data-edit]');
    if (!el || !el.isContentEditable) return;
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); el.blur(); }
    e.stopPropagation(); // keep typing from triggering card / page shortcuts
  }, true);

  document.addEventListener('paste', e => {
    const el = e.target.closest && e.target.closest('[data-edit]');
    if (!el || PLAIN === 'plaintext-only') return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s*\n\s*/g, ' '));
  }, true);

  // Clicks: outlined text is edited (not followed), photos open the photo picker.
  document.addEventListener('click', e => {
    if (e.target.closest('#ed-bar,#ed-menu,.ed-modal-bg,.ed-ctl,.ed-add,#ed-video-btn')) return;
    const txt = e.target.closest('[data-edit]');
    if (txt) {
      e.preventDefault();
      e.stopPropagation();
      if (!txt.isContentEditable) editButtonText(txt);
      return;
    }
    const img = e.target.closest('[data-img]');
    if (img) {
      e.preventDefault();
      e.stopPropagation();
      editPhoto(img.dataset.img);
      return;
    }
    // Leave normal behaviour for everything else (lesson rows, "Mark complete", tiers…),
    // but don't let links/forms leave the page while editing.
    const sub = e.target.closest('button[type=submit]');
    if (sub) e.preventDefault();
  }, true);

  function editButtonText(el) {
    const m = modal(`<h3>Edit button text</h3>
      <input type="text" value="${esc(el.textContent)}">
      <div class="ed-row"><button class="ed-btn" data-a="cancel">Cancel</button><button class="ed-btn primary" data-a="ok">Save</button></div>`);
    const save = () => {
      const v = m.$('input').value.trim();
      if (v) { el.textContent = v; setPath(el.dataset.edit, v); markDirty(); }
      m.close();
    };
    m.$('[data-a=ok]').onclick = save;
    m.$('[data-a=cancel]').onclick = m.close;
    m.$('input').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  }

  // ---------- Photos ----------
  function editPhoto(path) {
    const has = !!getPath(path);
    const m = modal(`<h3>${has ? 'Change' : 'Add'} photo</h3>
      <p>Upload a photo from your device (it's resized automatically), or paste a link to an image online.</p>
      <button class="ed-btn primary" data-a="upload" style="width:100%">Upload a photo…</button>
      <input type="file" accept="image/*" hidden>
      <label>…or paste an image link</label>
      <input type="url" placeholder="https://…" value="${has && !String(getPath(path)).startsWith('images/') ? esc(getPath(path)) : ''}">
      <div class="ed-err"></div>
      <div class="ed-row">
        ${has ? '<button class="ed-btn danger" data-a="remove" style="margin-right:auto">Remove photo</button>' : ''}
        <button class="ed-btn" data-a="cancel">Cancel</button><button class="ed-btn" data-a="link">Use link</button>
      </div>`);
    const file = m.$('input[type=file]');
    m.$('[data-a=upload]').onclick = () => file.click();
    m.$('[data-a=cancel]').onclick = m.close;
    if (has) m.$('[data-a=remove]').onclick = () => { setPath(path, ''); markDirty(); render(); m.close(); };
    m.$('[data-a=link]').onclick = () => {
      const u = m.$('input[type=url]').value.trim();
      if (!/^https?:\/\//i.test(u)) { m.$('.ed-err').textContent = 'Paste a full link starting with https://'; return; }
      setPath(path, u); markDirty(); render(); m.close();
    };
    file.onchange = async () => {
      const f = file.files[0];
      if (!f) return;
      m.$('[data-a=upload]').textContent = 'Preparing photo…';
      try {
        const { dataURL, base64, ext } = await resizeImage(f, 1800);
        const name = f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'photo';
        const repoPath = `images/${name}-${Date.now().toString(36)}.${ext}`;
        pending.set(repoPath, base64);
        IMG_PREVIEW[repoPath] = dataURL;
        setPath(path, repoPath);
        markDirty(); render(); m.close();
        toast('Photo added. Click <b>Publish</b> to put it on the live site.');
      } catch (err) {
        m.$('.ed-err').textContent = "Couldn't read that image. Try a JPG or PNG.";
        m.$('[data-a=upload]').textContent = 'Upload a photo…';
      }
    };
  }

  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const png = file.type === 'image/png' && file.size < 400000;
        const dataURL = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
        resolve({ dataURL, base64: dataURL.split(',')[1], ext: png ? 'png' : 'jpg' });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  // ---------- Lesson videos ----------
  function editVideo() {
    const c = findCourse(selectedCourse);
    const l = c.lessons[currentLesson];
    const m = modal(`<h3>Video for “${esc(l.t)}”</h3>
      <p>Paste a <b>YouTube</b> or <b>Vimeo</b> link (or a direct link to an .mp4 file). Tip: upload lessons to YouTube as “Unlisted” if you don't want them in YouTube search.</p>
      <input type="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(l.v || '')}">
      <div class="ed-err"></div>
      <div class="ed-row">
        ${l.v ? '<button class="ed-btn danger" data-a="remove" style="margin-right:auto">Remove video</button>' : ''}
        <button class="ed-btn" data-a="cancel">Cancel</button><button class="ed-btn primary" data-a="ok">Save</button>
      </div>`);
    const apply = v => { l.v = v; markDirty(); renderPlayer(); decorate(); m.close(); };
    m.$('[data-a=cancel]').onclick = m.close;
    if (l.v) m.$('[data-a=remove]').onclick = () => apply('');
    const ok = () => {
      const v = m.$('input').value.trim();
      if (!v) return apply('');
      if (videoHTML(v).startsWith('<video') && !/^https?:\/\/.+\.(mp4|webm|mov)(\?|$)/i.test(v)) {
        m.$('.ed-err').textContent = "That doesn't look like a YouTube, Vimeo or .mp4 link.";
        return;
      }
      apply(v);
    };
    m.$('[data-a=ok]').onclick = ok;
    m.$('input').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  }

  // ---------- Adding / removing items ----------
  window.edAdd = list => {
    const arr = getPath(list);
    const kind = list.endsWith('lessons') ? 'lessons' : list;
    arr.push(NEW_ITEMS[kind]());
    markDirty();
    if (kind === 'lessons') currentLesson = arr.length - 1;
    render();
    toast('Added — click the outlined text to fill it in.');
  };
  window.edRemove = (list, i, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const arr = getPath(list);
    const kind = list.endsWith('lessons') ? 'lesson' : { courses: 'course', team: 'person', stories: 'story' }[list] || 'item';
    if (kind === 'lesson' && arr.length <= 1) { toast('A course needs at least one lesson.'); return; }
    const label = arr[i].title || arr[i].t || arr[i].name || '';
    if (!confirm(`Remove this ${kind}${label ? ` (“${label}”)` : ''}?`)) return;
    arr.splice(i, 1);
    if (kind === 'lesson' && currentLesson >= arr.length) currentLesson = arr.length - 1;
    markDirty();
    render();
  };

  // ---------- Theme ----------
  function editTheme() {
    const t = SITE.theme = SITE.theme || {};
    const opts = (list, cur) => list.map(f => `<option${f === cur ? ' selected' : ''}>${f}</option>`).join('');
    const m = modal(`<h3>Colors &amp; fonts</h3>
      <p>Changes preview instantly on the page behind this window.</p>
      <label>Main color</label>
      <div class="ed-swatches">${PRESETS.map(([n, c]) => `<button class="ed-swatch${(t.accent || '').toLowerCase() === c.toLowerCase() ? ' on' : ''}" title="${n}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <div class="ed-color"><input type="color" value="${t.accent || '#C75D3A'}"><span>Or pick any color</span></div>
      <label>Heading font</label><select data-k="headingFont">${opts(HEAD_FONTS, t.headingFont || 'Newsreader')}</select>
      <label>Body font</label><select data-k="bodyFont">${opts(BODY_FONTS, t.bodyFont || 'Hanken Grotesk')}</select>
      <div class="ed-row"><button class="ed-btn primary" data-a="done">Done</button></div>`);
    const setColor = c => {
      t.accent = c; applyTheme(); markDirty();
      m.box.querySelectorAll('.ed-swatch').forEach(s => s.classList.toggle('on', s.dataset.c.toLowerCase() === c.toLowerCase()));
      m.$('input[type=color]').value = c;
    };
    m.box.querySelectorAll('.ed-swatch').forEach(s => s.onclick = () => setColor(s.dataset.c));
    m.$('input[type=color]').oninput = e => setColor(e.target.value);
    m.box.querySelectorAll('select').forEach(s => s.onchange = () => { t[s.dataset.k] = s.value; applyTheme(); markDirty(); });
    m.$('[data-a=done]').onclick = m.close;
  }

  // ---------- GitHub connection ----------
  async function gh(path, opts = {}, tok = token) {
    const res = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}${path}`, {
      ...opts,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${tok}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    if (!res.ok) {
      let msg = '';
      try { msg = (await res.json()).message || ''; } catch (e) {}
      const err = new Error(msg || `GitHub error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  function connect() {
    return new Promise(resolve => {
      const m = modal(`<h3>Connect to GitHub</h3>
        <p>Publishing saves your changes to <b>${REPO.owner}/${REPO.repo}</b>. To do that, this editor needs an access key that only you have. You only do this once per device.</p>
        <ol>
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New fine-grained token</a>.</li>
          <li><b>Token name:</b> <code>Gears site editor</code> · <b>Expiration:</b> 90 days.</li>
          <li><b>Repository access:</b> “Only select repositories” → <code>${REPO.repo}</code>.</li>
          <li><b>Permissions → Repository permissions → Contents:</b> “Read and write”.</li>
          <li>Click <b>Generate token</b>, copy it, and paste it below.</li>
        </ol>
        <label>Access key</label>
        <input type="password" placeholder="github_pat_…" autocomplete="off">
        <p style="font-size:13.5px;margin-top:10px">Stored only in this browser. Never share it or paste it into the page text. Use <b>Sign out</b> in the ⋯ menu on shared computers.</p>
        <div class="ed-err"></div>
        <div class="ed-row"><button class="ed-btn" data-a="cancel">Cancel</button><button class="ed-btn primary" data-a="ok">Connect</button></div>`);
      m.$('[data-a=cancel]').onclick = () => { m.close(); resolve(false); };
      const ok = async () => {
        const v = m.$('input').value.trim();
        if (!v) return;
        const btn = m.$('[data-a=ok]');
        btn.disabled = true; btn.textContent = 'Checking…';
        try {
          await gh('', {}, v);
          token = v;
          try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {}
          m.close(); resolve(true);
        } catch (err) {
          m.$('.ed-err').textContent = err.status === 401
            ? "GitHub didn't accept that key. Check you copied all of it."
            : `That key can't see ${REPO.owner}/${REPO.repo}. Make sure you chose this repository under “Repository access”.`;
          btn.disabled = false; btn.textContent = 'Connect';
        }
      };
      m.$('[data-a=ok]').onclick = ok;
      m.$('input').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    });
  }

  // ---------- Publishing ----------
  const utf8ToB64 = s => { const b = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(bin); };
  const b64ToUtf8 = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));

  const DATA_RE = /(<script id="site-data" type="application\/json">\n?)([\s\S]*?)(\n?<\/script>)/;
  const norm = txt => { try { return JSON.stringify(JSON.parse(txt)); } catch (e) { return txt; } };
  let baseData = null; // the content block as last loaded from / saved to GitHub

  async function fetchIndexFromGitHub(ref) {
    const q = `/contents/index.html${ref ? `?ref=${ref}` : ''}`;
    if (token) { try { return await gh(q); } catch (e) { if (e.status !== 401) throw e; } }
    const res = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('GitHub error ' + res.status);
    return res.json();
  }

  // The live site can lag behind GitHub by a few minutes (caching / rebuilding),
  // so always start editing from the newest saved version.
  async function loadLatest() {
    try {
      const m = b64ToUtf8((await fetchIndexFromGitHub()).content).match(DATA_RE);
      if (!m) return;
      baseData = m[2];
      if (norm(m[2]) === JSON.stringify(SITE) || dirty) return;
      const remote = JSON.parse(m[2]);
      Object.keys(SITE).forEach(k => delete SITE[k]);
      Object.assign(SITE, remote);
      applyTheme(); applyText(); render();
      toast('Loaded your newest saved version (the live site is still catching up).', 5000);
    } catch (e) { /* offline or rate-limited: keep what the page has */ }
  }

  function siteDataJSON() {
    // < keeps "</script>" or "<!--" inside text from breaking the page.
    return JSON.stringify(SITE, null, 1).replace(/</g, '\\u003c');
  }

  async function publishOnce() {
    const repo = await gh('');
    const branch = repo.default_branch;
    const ref = await gh(`/git/ref/heads/${encodeURIComponent(branch)}`);
    const headSha = ref.object.sha;
    const head = await gh(`/git/commits/${headSha}`);
    const file = await gh(`/contents/index.html?ref=${headSha}`);
    const html = b64ToUtf8(file.content);
    const m = html.match(DATA_RE);
    if (!m) throw new Error("index.html on GitHub doesn't have a content block the editor can update");
    if (baseData !== null && norm(m[2]) !== norm(baseData) && !confirm(
      'The site was changed somewhere else (another device or a direct GitHub edit) since you opened the editor.\n\nPublish anyway and replace those changes with yours?')) {
      const err = new Error('cancelled'); err.cancelled = true; throw err;
    }
    const json = siteDataJSON();
    const newHtml = html.replace(DATA_RE, (_, a, __, b) => a + json + b);

    const entries = [];
    for (const [path, b64] of pending) {
      const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: b64, encoding: 'base64' }) });
      entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const htmlBlob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: utf8ToB64(newHtml), encoding: 'base64' }) });
    entries.push({ path: 'index.html', mode: '100644', type: 'blob', sha: htmlBlob.sha });

    const tree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }) });
    const n = pending.size;
    const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({
      message: `Update site from visual editor${n ? ` (+${n} photo${n > 1 ? 's' : ''})` : ''}`,
      tree: tree.sha, parents: [headSha]
    }) });
    await gh(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    baseData = json;
    return commit;
  }

  async function publish() {
    if (!dirty) return;
    if (!token && !(await connect())) return;
    const btn = document.querySelector('#ed-bar .ed-publish');
    btn.disabled = true; btn.textContent = 'Publishing…';
    toast('Publishing…', 0);
    try {
      let commit;
      try { commit = await publishOnce(); }
      catch (err) { if (err.status === 422 || err.status === 409) commit = await publishOnce(); else throw err; } // someone else saved meanwhile: retry on top
      pending.clear();
      markClean();
      toast(`Published! The live site updates in about a minute. <a href="https://github.com/${REPO.owner}/${REPO.repo}/commit/${commit.sha}" target="_blank" rel="noopener">View change</a>`, 9000);
    } catch (err) {
      btn.disabled = false;
      if (err.cancelled) {
        toast('Not published. Use ⋯ → Discard to load the newest version, then redo your edits.', 8000);
      } else if (err.status === 401) {
        token = null;
        try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
        toast('Your GitHub key expired or was revoked. Click Publish to connect a new one.', 8000);
      } else if (err.status === 403 || err.status === 404) {
        toast('Your key isn\'t allowed to save here. Make sure it has <b>Contents: Read and write</b> for this repository, then sign out (⋯ menu) and reconnect.', 10000);
      } else {
        toast(`Couldn't publish: ${esc(err.message)}. Your changes are still here — try again.`, 10000);
      }
    } finally {
      btn.textContent = 'Publish';
    }
  }

  // ---------- Toolbar ----------
  const bar = h('div', { id: 'ed-bar' }, `
    <div class="ed-badge"><span class="ed-dot"></span><span class="ed-status">All changes published</span></div>
    <select id="ed-page" aria-label="Go to page">${PAGES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
    <button type="button" data-a="theme">🎨 Theme</button>
    <button type="button" class="ed-publish" data-a="publish" disabled>Publish</button>
    <button type="button" data-a="more" aria-label="More options">⋯</button>`);
  document.body.appendChild(bar);
  bar.querySelector('#ed-page').onchange = e => goTab(e.target.value);
  bar.querySelector('[data-a=theme]').onclick = editTheme;
  bar.querySelector('[data-a=publish]').onclick = publish;
  bar.querySelector('[data-a=more]').onclick = e => {
    const old = document.getElementById('ed-menu');
    if (old) { old.remove(); return; }
    const menu = h('div', { id: 'ed-menu' }, `
      <button data-a="discard">↺ Discard unpublished changes</button>
      <button data-a="signout">${token ? 'Sign out of GitHub on this device' : 'Connect to GitHub…'}</button>
      <button data-a="history">View change history on GitHub</button>
      <button data-a="exit">Exit editor</button>`);
    document.body.appendChild(menu);
    const r = e.currentTarget.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = (r.top - menu.offsetHeight - 8) + 'px';
    const close = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true));
    menu.onclick = ev => {
      const a = ev.target.dataset.a;
      menu.remove();
      if (a === 'discard') { if (!dirty || confirm('Throw away all unpublished changes?')) { dirty = false; location.reload(); } }
      else if (a === 'signout') {
        if (token) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} toast('Signed out. The access key was removed from this browser.'); }
        else connect();
      }
      else if (a === 'history') window.open(`https://github.com/${REPO.owner}/${REPO.repo}/commits`, '_blank', 'noopener');
      else if (a === 'exit') {
        if (dirty && !confirm('You have unpublished changes. Leave without publishing?')) return;
        dirty = false;
        location.href = location.pathname + location.search;
      }
    };
  };

  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  render();
  loadLatest();
  toast('Editing mode. Click any outlined text to change it, or a photo to replace it. Then hit <b>Publish</b>.', 6000);
})();
