/* WebOS session: boot screen, accounts, login/lock screen, sign out, power */
'use strict';

OS.accounts = {
  all() { return OS.storage.get('users', {}); },
  get(u) { return this.all()[u] || null; },
  save(users) { OS.storage.set('users', users); },
  async create({ username, name, password = '', color }) {
    username = (username || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{1,24}$/.test(username)) throw new Error('Username may only contain letters, numbers, dot, dash and underscore (max 24).');
    const users = this.all();
    if (users[username]) throw new Error('That username is already taken.');
    const salt = U.uid();
    users[username] = {
      name: (name || username).trim().slice(0, 40), salt,
      hash: password ? await U.sha256(salt + password) : '',
      color: color || ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'][Object.keys(users).length % 7],
      created: Date.now(),
    };
    this.save(users);
    return users[username];
  },
  async verify(username, password) {
    const u = this.get(username);
    if (!u) return false;
    if (!u.hash) return true;
    return (await U.sha256(u.salt + password)) === u.hash;
  },
  async setPassword(username, password) {
    const users = this.all();
    const u = users[username];
    u.salt = U.uid();
    u.hash = password ? await U.sha256(u.salt + password) : '';
    this.save(users);
  },
  update(username, patch) {
    const users = this.all();
    Object.assign(users[username], patch);
    this.save(users);
    if (OS.user && OS.user.username === username) Object.assign(OS.user, patch);
  },
  async remove(username) {
    const users = this.all();
    delete users[username];
    this.save(users);
    await OS.idb.del('fs:' + username);
    OS.storage.keys('settings.' + username).concat(OS.storage.keys('data.' + username + '.'), OS.storage.keys('assoc.' + username)).forEach(k => OS.storage.remove(k));
  },
};

OS.session = (() => {
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let clockTimer = null;

  async function boot() {
    const b = $('boot');
    b.hidden = false;
    const bar = b.querySelector('.boot-bar i');
    const msg = b.querySelector('.boot-msg');
    const steps = ['Loading kernel…', 'Mounting file system…', 'Starting services…', 'Loading apps (' + Object.keys(OS.apps).length + ')…', 'Ready'];
    for (let i = 0; i < steps.length; i++) {
      msg.textContent = steps[i];
      bar.style.width = ((i + 1) / steps.length * 100) + '%';
      await sleep(i === steps.length - 1 ? 150 : 260);
    }
    b.classList.add('fade');
    await sleep(350);
    b.hidden = true;
    b.classList.remove('fade');
    showLogin();
  }

  /* ---------- Login / lock screen ---------- */
  function showLogin({ lock = false } = {}) {
    const L = $('login');
    L.hidden = false;
    L.className = lock ? 'lock' : '';
    L.innerHTML = '';
    const users = OS.accounts.all();
    const names = Object.keys(users);
    const clock = U.h('div', { class: 'login-clock' }, U.h('div', { class: 'lc-time' }), U.h('div', { class: 'lc-date' }));
    const tickClock = () => {
      const n = new Date();
      clock.firstChild.textContent = n.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      clock.lastChild.textContent = n.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    };
    tickClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(tickClock, 1000);
    const panel = U.h('div', { class: 'login-panel' });
    L.append(clock, panel);

    if (lock) return renderUser(panel, OS.user.username, true);
    const last = OS.storage.get('lastUser');
    if (!names.length) return renderCreate(panel, true);
    renderUser(panel, names.includes(last) ? last : names[0]);
    {
      const list = U.h('div', { class: 'login-users' },
        names.map(n => U.h('button', { class: 'lu', onclick: () => renderUser(panel, n) },
          U.h('span', { class: 'avatar', style: { background: users[n].color } }, (users[n].name || n)[0].toUpperCase()),
          U.h('span', {}, users[n].name || n))),
        U.h('button', { class: 'lu', onclick: () => renderCreate(panel) }, U.h('span', { class: 'avatar add' }, '+'), U.h('span', {}, 'New account')));
      L.append(list);
    }
  }

  function renderUser(panel, username, lock = false) {
    const u = OS.accounts.get(username);
    panel.innerHTML = '';
    const err = U.h('div', { class: 'login-err' });
    const pass = U.h('input', { class: 'input', type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
    const go = async () => {
      const ok = await OS.accounts.verify(username, pass.value);
      if (!ok) {
        err.textContent = 'Incorrect password. Try again.';
        panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake');
        OS.sound.play('error');
        pass.select();
        return;
      }
      if (lock) unlock(); else login(username);
    };
    pass.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    U.append(panel,
      U.h('div', { class: 'avatar big', style: { background: u.color } }, (u.name || username)[0].toUpperCase()),
      U.h('div', { class: 'login-name' }, u.name || username),
      u.hash
        ? U.h('div', { class: 'login-row' }, pass, U.h('button', { class: 'btn primary arrow', onclick: go, title: 'Sign in' }, '→'))
        : U.h('button', { class: 'btn primary wide', onclick: go }, lock ? 'Unlock' : 'Sign in'),
      err,
      lock ? U.h('button', { class: 'btn link', onclick: () => { unlock(true); logout(); } }, 'Switch user') : null);
    setTimeout(() => (u.hash ? pass : panel.querySelector('button.primary')).focus(), 60);
  }

  function renderCreate(panel, first = false) {
    panel.innerHTML = '';
    const err = U.h('div', { class: 'login-err' });
    const name = U.h('input', { class: 'input', placeholder: 'Your name', autocomplete: 'name' });
    const user = U.h('input', { class: 'input', placeholder: 'Username', autocomplete: 'username' });
    const pass = U.h('input', { class: 'input', type: 'password', placeholder: 'Password (optional)', autocomplete: 'new-password' });
    const pass2 = U.h('input', { class: 'input', type: 'password', placeholder: 'Confirm password', autocomplete: 'new-password' });
    let userEdited = false;
    user.oninput = () => { userEdited = true; };
    name.oninput = () => { if (!userEdited) user.value = name.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 24); };
    const go = async () => {
      err.textContent = '';
      if (!user.value.trim()) { err.textContent = 'Please choose a username.'; return; }
      if (pass.value !== pass2.value) { err.textContent = 'Passwords do not match.'; return; }
      try {
        await OS.accounts.create({ username: user.value, name: name.value || user.value, password: pass.value });
        login(user.value.trim().toLowerCase());
      } catch (e) { err.textContent = e.message; OS.sound.play('error'); }
    };
    [name, user, pass, pass2].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
    U.append(panel,
      U.h('div', { class: 'avatar big add' }, '+'),
      U.h('div', { class: 'login-name' }, first ? `Welcome to ${OS.name}` : 'Create account'),
      first ? U.h('p', { class: 'login-sub' }, 'Create an account to get started. Your files and settings are saved privately in this browser.') : null,
      U.h('div', { class: 'login-form' }, name, user, pass, pass2),
      U.h('button', { class: 'btn primary wide', onclick: go }, 'Create account'),
      err,
      !first ? U.h('button', { class: 'btn link', onclick: () => showLogin() }, 'Back') : null);
    setTimeout(() => name.focus(), 60);
  }

  async function login(username) {
    const L = $('login');
    const u = OS.accounts.get(username);
    OS.user = Object.assign({ username }, u);
    OS.storage.set('lastUser', username);
    OS.settings.load();
    L.classList.add('fade');
    OS.fs = await OS.VFS.open(username);
    OS.applySettings();
    clearInterval(clockTimer);
    await sleep(300);
    L.hidden = true;
    L.classList.remove('fade');
    $('shell').hidden = false;
    OS.shell.start();
    OS.services.start();
    OS.sound.play('startup');
    const first = !OS.data.get('welcomed', false);
    if (first) {
      OS.data.set('welcomed', true);
      setTimeout(() => OS.notify({ title: `Welcome, ${OS.user.name}!`, body: 'Click here for a quick tour of WebOS.', icon: 'logo', timeout: 9000, sound: false, action: () => OS.openFile('/Desktop/Welcome.txt') }), 900);
    }
    OS.bus.emit('session:login');
  }

  let locked = false;
  function lock() {
    if (!OS.user) return;
    locked = true;
    OS.session.locked = true;
    showLogin({ lock: true });
  }
  function unlock(silent) {
    locked = false;
    OS.session.locked = false;
    clearInterval(clockTimer);
    $('login').hidden = true;
    if (!silent) OS.sound.play('pop');
  }

  async function logout() {
    try { await endSession(); } catch { return; }
    showLogin();
  }

  async function endSession() {
    if (!OS.user) return;
    // Give apps a chance to save (e.g. unsaved documents)
    for (const w of OS.wm.list()) {
      w.focus();
      await w.close();
      if (!w.closed) return Promise.reject(new Error('cancelled'));
    }
    OS.services.stop();
    await OS.fs.flush();
    OS.shell.stop();
    $('shell').hidden = true;
    OS.user = null;
    OS.fs = null;
    OS.notifications.length = 0;
    document.documentElement.dataset.theme = 'dark';
  }

  async function power(mode) {
    try { if (OS.user) await endSession(); } catch { return; }
    OS.sound.play('shutdown');
    const P = $('power-screen');
    P.hidden = false;
    $('login').hidden = true;
    P.innerHTML = `<div class="spinner"></div><div>${mode === 'restart' ? 'Restarting…' : 'Shutting down…'}</div>`;
    await sleep(1400);
    if (mode === 'restart') { location.reload(); return; }
    P.innerHTML = '';
    P.append(U.h('div', { class: 'off-msg' }, 'It is now safe to turn off your computer.'),
      U.h('button', { class: 'power-on', title: 'Power on', onclick: () => location.reload(), html: '<svg viewBox="0 0 24 24" width="40" height="40"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></g></svg>' }));
  }

  // Save on tab close
  window.addEventListener('beforeunload', () => { if (OS.fs) OS.fs.flush(); });
  window.addEventListener('pagehide', () => { if (OS.fs) OS.fs.flush(); });

  return { boot, login, logout, lock, unlock, power, locked: false, showLogin };
})();
