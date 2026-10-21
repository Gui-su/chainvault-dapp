/* ============================================================
 *  ChainVault DApp  ·  公共 UI / 鉴权 (app.js)
 * ============================================================ */
(function (global) {
  'use strict';

  const App = {};

  /* ---------- 路径基准 ---------- */
  App.isSub = /\/pages\//.test(location.pathname.replace(/\\/g, '/'));
  App.base = () => (App.isSub ? '../' : '');
  App.page = (p) => App.base() + 'pages/' + p;
  App.home = () => App.base() + 'index.html';

  /* ---------- 格式化 ---------- */
  App.fmt = {
    addr(a, n) {
      a = String(a || '');
      n = n || 6;
      return a.length > n * 2 ? a.slice(0, n + 2) + '…' + a.slice(-n) : a;
    },
    date(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d)) return String(iso).slice(0, 10);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    dateTime(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      return App.fmt.date(iso) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    },
    ago(iso) {
      const diff = Date.now() - new Date(iso).getTime();
      const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
      if (m < 1) return '刚刚';
      if (m < 60) return m + ' 分钟前';
      if (h < 24) return h + ' 小时前';
      if (d < 30) return d + ' 天前';
      return Math.floor(d / 30) + ' 个月前';
    },
    eth(n) { return Number(n || 0).toFixed(3); },
    num(n) { return Number(n || 0).toLocaleString('zh-CN'); },
    size(s) { return s; },
  };

  App.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.avatarColor = (str) => {
    let h = 0; String(str || '').split('').forEach(c => h = (h * 31 + c.charCodeAt(0)) % 360);
    return `linear-gradient(135deg,hsl(${h},40%,48%),hsl(${(h + 40) % 360},34%,40%))`;
  };
  App.initial = (name) => {
    const s = String(name || '0x');
    if (/^[一-龥]/.test(s)) return s.slice(0, 1);
    return s.replace(/^0x/, '').slice(0, 2).toUpperCase();
  };

  /* ---------- Toast ---------- */
  App.toast = function (msg, type, title, ms) {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toast-wrap'; document.body.appendChild(wrap); }
    const ico = { ok: '✅', err: '⛔', info: 'ℹ️', warn: '⚠️' }[type || 'info'];
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = `<div class="ico">${ico}</div><div style="flex:1">
      ${title ? `<b>${App.esc(title)}</b>` : ''}
      <p>${String(msg).replace(/\n/g, '<br>')}</p></div>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms || (type === 'err' ? 5200 : 3800));
    return el;
  };

  /* ---------- Modal ---------- */
  App.modal = function (opts) {
    let root = document.getElementById('modal-root');
    if (!root) { root = document.createElement('div'); root.id = 'modal-root'; document.body.appendChild(root); }
    const btns = (opts.buttons || []).map((b, i) =>
      `<button class="btn ${b.cls || ''}" data-i="${i}">${b.text}</button>`).join('');
    root.innerHTML = `<div class="mask" data-close="1"></div>
      <div class="box">
        <button class="close" data-close="1">✕</button>
        <h3>${opts.title || ''}</h3>
        <div class="mt-8 dim" style="font-size:14px">${opts.body || ''}</div>
        ${btns ? `<div class="row mt-24" style="justify-content:flex-end;gap:10px">${btns}</div>` : ''}
      </div>`;
    root.classList.add('on');
    root.querySelectorAll('[data-close]').forEach(el => el.onclick = () => App.closeModal());
    root.querySelectorAll('.box button[data-i]').forEach(el => {
      el.onclick = () => {
        const b = opts.buttons[+el.dataset.i];
        if (!b.keepOpen) App.closeModal();
        if (b.onClick) b.onClick();
      };
    });
  };
  /* 只隐藏、不清空内容：确认按钮的回调需要读取弹窗内的输入框，
     若先清空 innerHTML，回调里 getElementById 会拿到 null（兑换/调价/自动回复都会静默失败）。
     下次调用 App.modal 时会整体覆盖 innerHTML，不存在内容残留问题。 */
  App.closeModal = function () {
    const root = document.getElementById('modal-root');
    if (root) root.classList.remove('on');
  };
  App.alert = (title, body) => App.modal({ title, body, buttons: [{ text: '知道了', cls: 'btn-primary' }] });
  App.confirm = function (title, body, okText, onOk, danger) {
    App.modal({
      title, body,
      buttons: [
        { text: '取消', cls: 'btn-ghost' },
        { text: okText || '确定', cls: danger ? 'btn-danger' : 'btn-primary', onClick: onOk }
      ]
    });
  };

  /* ---------- 会话 ---------- */
  App.session = () => Store.session();
  App.login = (s) => Store.setSession(Object.assign({ loginAt: Date.now() }, s));
  App.logout = function () {
    Store.clearSession();
    App.toast('已安全退出登录', 'ok');
    setTimeout(() => location.href = App.home(), 700);
  };
  App.requireLogin = function (redirect) {
    const s = App.session();
    if (!s) {
      App.confirm('需要登录', '该操作需要先连接钱包或登录账号，是否前往登录页？', '去登录', () => {
        location.href = App.page('login.html') + (redirect ? '?redirect=' + encodeURIComponent(redirect) : '');
      });
      return null;
    }
    return s;
  };
  App.requirePageLogin = function () {
    const s = App.session();
    if (!s) {
      location.href = App.page('login.html') + '?redirect=' + encodeURIComponent(location.pathname.split('/').pop());
      return null;
    }
    return s;
  };
  App.requireAdmin = function () {
    const s = App.session();
    if (!s || s.role !== 'admin') {
      document.body.innerHTML = `<div class="container" style="padding:120px 24px;text-align:center">
        <div style="font-size:52px">🔒</div>
        <h2 style="margin:12px 0 8px">无访问权限</h2>
        <p class="dim">管理员后台仅对平台管理员开放，请先使用管理员账号登录。</p>
        <div class="row" style="justify-content:center;gap:10px;margin-top:20px">
          <a class="btn btn-primary" href="${App.page('login.html')}?redirect=admin.html">管理员登录</a>
          <a class="btn" href="${App.home()}">返回首页</a>
        </div></div>`;
      return null;
    }
    return s;
  };

  App.copy = function (text, tip) {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      else {
        const t = document.createElement('textarea');
        t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
      }
      App.toast(tip || '已复制到剪贴板', 'ok');
    } catch (e) { App.toast('复制失败，请手动选择文本', 'err'); }
  };

  /* ---------- 作品卡片 ---------- */
  App.coverInner = function (w, glyphSize) {
    const t = Store.TYPE_MAP[w.type] || Store.TYPE_MAP.art;
    if (w.cover) {
      return `<img src="${w.cover}" alt="${App.esc(w.title)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
    }
    return `<div class="glyph"${glyphSize ? ` style="font-size:${glyphSize}"` : ''}>${t.icon}</div>`;
  };

  /* 作品可选授权方式（多选，兼容旧的单选字段） */
  App.licenseTypesOf = function (w) {
    const arr = (w && w.licenseTypes && w.licenseTypes.length) ? w.licenseTypes : [w.licenseType || 'commercial'];
    return arr.filter(k => Store.LICENSE_MAP[k]);
  };

  App.workCard = function (w) {
    const t = Store.TYPE_MAP[w.type] || Store.TYPE_MAP.art;
    const types = App.licenseTypesOf(w);
    const hasCredit = types.indexOf('personal') >= 0;
    return `<a class="work-card fade-in" href="${App.page('detail.html')}?id=${encodeURIComponent(w.id)}">
      <div class="cover ${t.color}">
        <span class="top-tag">${t.icon} ${App.esc(t.label)}</span>
        ${App.coverInner(w)}
        <div class="stat-tag"><span>👁 ${App.fmt.num(w.views)}</span><span>♥ ${App.fmt.num(w.likes)}</span></div>
      </div>
      <div class="work-body">
        <h4>${App.esc(w.title)}</h4>
        <p class="desc">${App.esc(w.desc)}</p>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          ${types.map(k=>`<span class="badge ${k==='personal'?'cyan':'info'}">${App.esc(Store.LICENSE_MAP[k].label)}</span>`).join('')}
          ${w.resale ? '<span class="badge cyan">二次流转</span>' : ''}
          ${w.status === 'approved'
            ? '<span class="badge ok">已存证</span>'
            : `<span class="badge ${(Store.STATUS_MAP[w.status] || Store.STATUS_MAP.rejected).cls}">${(Store.STATUS_MAP[w.status] || Store.STATUS_MAP.rejected).label}</span>`}
        </div>
        <div class="work-foot">
          <div class="row" style="gap:8px">
            <div class="avatar sm" style="background:${App.avatarColor(w.ownerName)}">${App.esc(App.initial(w.ownerName))}</div>
            <div class="truncate" style="font-size:12.5px;color:var(--text-dim);max-width:96px">${App.esc(w.ownerName)}</div>
          </div>
          <div class="price">
            ${hasCredit
              ? `<b>${App.fmt.num(w.personalCredits || 0)}</b><small>${Store.CREDIT.unit} 起</small>`
              : `<b>${App.fmt.eth(w.price)}</b><small>ETH</small>`}
          </div>
        </div>
      </div>
    </a>`;
  };

  App.typeChip = (t) => {
    const m = Store.TYPE_MAP[t] || Store.TYPE_MAP.art;
    return `<span class="badge" style="white-space:nowrap">${m.icon} ${m.label}</span>`;
  };

  /* ---------- 收藏 ---------- */
  const FAV_KEY = 'chainvault:favs';
  App.favs = () => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; }
  };
  App.isFav = (id) => App.favs().indexOf(id) >= 0;
  App.toggleFav = (id) => {
    const list = App.favs();
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
    return i < 0;
  };

  /* ---------- 本地图片压缩与选择（封面编辑复用） ---------- */
  App.compressImage = function (file, maxW, q) {
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(1, maxW / img.width);
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * scale));
            c.height = Math.max(1, Math.round(img.height * scale));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            res(c.toDataURL('image/jpeg', q));
          } catch (e) { res(null); }
        };
        img.onerror = () => res(null);
        img.src = reader.result;
      };
      reader.onerror = () => res(null);
      reader.readAsDataURL(file);
    });
  };
  App.pickImage = function (cb) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = async (e) => {
      const f = e.target.files[0];
      if (f) { const url = await App.compressImage(f, 720, 0.72); cb(url, f); }
      inp.remove();
    };
    inp.click();
  };

  /* ---------- 顶部导航 ---------- */
  App.mountNav = function (active, opts) {
    opts = opts || {};
    document.querySelectorAll('[data-nav]').forEach(el => {
      const b = App.base();
      el.innerHTML = `<div class="nav-inner">
        <a href="${App.home()}" class="logo" style="margin-right:6px">
          <span class="logo-mark">🛡️</span>
          <span>ChainVault<small>DIGITAL RIGHTS</small></span>
        </a>
        <nav class="nav-links" id="navLinks">
          <a href="${App.home()}" data-k="home" class="${active === 'home' ? 'active' : ''}">首页</a>
          <a href="${App.page('works.html')}" data-k="works" class="${active === 'works' ? 'active' : ''}">版权市场</a>
          <a href="${App.page('create.html')}" data-k="create" class="${active === 'create' ? 'active' : ''}">作品确权</a>
          <a href="${App.page('dashboard.html')}" data-k="dash" class="${active === 'dash' ? 'active' : ''}">我的版权</a>
          <a href="${App.page('credits.html')}" data-k="credits" class="${active === 'credits' ? 'active' : ''}">积分中心</a>
          <a href="${App.page('admin.html')}" data-k="admin" class="${active === 'admin' ? 'active' : ''}">管理平台</a>
        </nav>
        <div class="nav-right">
          <span class="net-pill hide-sm" id="netPill"><i class="dot ${App.session() && App.session().walletMode === 'wallet' ? '' : 'demo'}"></i><span id="netName">加载中…</span></span>
          <a class="btn btn-sm ${active === 'msg' ? 'btn-outline' : ''}" id="msgBtn" href="${App.page('messages.html')}" title="进入消息中心">
            💬 消息中心<span class="badge err" id="msgBadge" style="display:none;padding:1px 6px;font-size:11px;margin-left:2px">0</span>
          </a>
          <button class="burger" id="burger">☰</button>
          <div id="authSlot"></div>
        </div>
      </div>`;

      const links = document.getElementById('navLinks');
      const burger = document.getElementById('burger');
      if (burger) burger.onclick = () => links.classList.toggle('open');

      /* 消息中心入口：未登录时先引导登录，登录后带参返回 */
      const msgBtn = document.getElementById('msgBtn');
      if (msgBtn) msgBtn.onclick = (e) => {
        if (!App.session()) {
          e.preventDefault();
          location.href = App.page('login.html') + '?redirect=messages.html';
        }
      };

      App.renderAuth();
      App.refreshNet();
      App.refreshMsg();
    });
  };

  /* ---------- 消息未读角标 ---------- */
  App.refreshMsg = function () {
    const el = document.getElementById('msgBadge');
    if (!el) return;
    const s = App.session();
    if (!s) { el.style.display = 'none'; return; }
    const n = Store.unreadFor(s.address).count;
    el.textContent = n > 99 ? '99+' : n;
    el.style.display = n ? 'inline-flex' : 'none';
  };
  setInterval(function () { try { App.refreshMsg(); } catch (e) {} }, 15000);

  App.refreshNet = function () {
    const el = document.getElementById('netName');
    const dot = document.querySelector('#netPill .dot');
    if (!el) return;
    const s = App.session();
    const mode = s ? s.walletMode : Web3.mode;
    const label = Web3.chainLabel();
    if (s && s.walletMode === 'wallet') {
      el.textContent = label + ' · 已连接';
      if (dot) dot.className = 'dot';
    } else {
      el.textContent = label + ' · 演示模式';
      if (dot) dot.className = 'dot demo';
    }
  };

  App.renderAuth = function () {
    const slot = document.getElementById('authSlot');
    if (!slot) return;
    const s = App.session();
    if (!s) {
      slot.innerHTML = `
        <a class="btn btn-outline btn-sm" href="${App.page('login.html')}">👤 登录 / 注册</a>
        <button class="btn btn-primary btn-sm" id="btnConnect">🔗 连接钱包</button>`;
      document.getElementById('btnConnect').onclick = () => App.connectFlow();
      return;
    }
    slot.innerHTML = `
      <div class="row" style="gap:8px">
        <a class="btn btn-sm hide-sm" href="${App.page('works.html')}">去确权</a>
        <button class="row" id="userBtn" style="gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:5px 11px;cursor:pointer">
          <span class="avatar sm" style="background:${App.avatarColor(s.name || s.address)}">${App.esc(App.initial(s.name || s.address))}</span>
          <span style="font-size:13px;font-weight:600">${App.esc(s.name || App.fmt.addr(s.address, 4))}</span>
          ${s.role === 'admin' ? '<span class="badge err" style="padding:2px 7px;font-size:11px">ADMIN</span>' : ''}
        </button>
      </div>`;
    document.getElementById('userBtn').onclick = () => App.userMenu();
  };

  App.userMenu = function () {
    const s = App.session();
    if (!s) return;
    const body = `
      <div class="row mb-16" style="gap:12px">
        <div class="avatar lg" style="background:${App.avatarColor(s.name || s.address)}">${App.esc(App.initial(s.name || s.address))}</div>
        <div>
          <div style="font-weight:700;font-size:16px">${App.esc(s.name)}</div>
          <div class="mono mute" style="font-size:12px">${App.fmt.addr(s.address, 8)}</div>
          <div class="mt-8">${s.role === 'admin' ? '<span class="badge err">平台管理员</span>' : '<span class="badge cyan">创作者</span>'} <span class="badge">${s.walletMode === 'wallet' ? '链上钱包' : '演示钱包'}</span></div>
        </div>
      </div>
      <div class="kv"><span class="k">登录方式</span><span class="v">${s.method === 'wallet' ? '钱包签名登录' : '邮箱账号登录'}</span></div>
      <div class="kv"><span class="k">登录时间</span><span class="v">${App.fmt.dateTime(new Date(s.loginAt).toISOString())}</span></div>
      <div class="kv"><span class="k">钱包余额</span><span class="v" id="balTxt">读取中…</span></div>`;
    App.modal({
      title: '账户信息',
      body,
      buttons: [
        { text: '复制地址', cls: 'btn-ghost', keepOpen: true, onClick: () => App.copy(s.address) },
        { text: s.role === 'admin' ? '管理员后台' : '我的版权', cls: 'btn-outline', onClick: () => location.href = App.page(s.role === 'admin' ? 'admin.html' : 'dashboard.html') },
        { text: '退出登录', cls: 'btn-danger', onClick: () => App.logout() }
      ]
    });
    Web3.balance().then(b => { const el = document.getElementById('balTxt'); if (el) el.textContent = b + ' ETH'; });
  };

  /* ---------- 连接 / 登录流 ---------- */
  App.connectFlow = function (after) {
    App.modal({
      title: '连接钱包',
      body: `
        <p class="dim" style="margin:0 0 16px;font-size:13.5px">选择你的登录方式。平台使用钱包签名完成去中心化身份校验，全程不会获取你的私钥。</p>
        <div class="col" style="gap:10px">
          <button class="btn btn-primary btn-lg btn-block" id="mMeta">${Web3.hasWallet() ? '🦊 ' + Web3.walletName() + ' 钱包登录' : '🦊 MetaMask 钱包登录'}</button>
          <button class="btn btn-lg btn-block" id="mWc">🔐 WalletConnect 扫码登录</button>
          <button class="btn btn-lg btn-block" id="mDemo">🧪 演示钱包（无需插件）</button>
          <a class="btn btn-lg btn-block btn-ghost" href="${App.page('login.html')}${after ? '?redirect=' + encodeURIComponent(after) : ''}">📧 邮箱账号登录 / 注册</a>
        </div>
        <p class="hint mt-16">若无浏览器钱包插件，可使用演示钱包完整体验确权、授权与交易全流程。</p>`,
      buttons: [{ text: '取消', cls: 'btn-ghost' }]
    });
    document.getElementById('mMeta').onclick = () => App.doWalletLogin(false);
    document.getElementById('mWc').onclick = () => App.doWalletLogin(false);
    document.getElementById('mDemo').onclick = () => App.doWalletLogin(true);
  };

  App.doWalletLogin = async function (forceDemo) {
    App.closeModal();
    let st;
    try {
      if (forceDemo) {
        App.toast('正在生成演示身份...', 'info');
        st = await Web3.connect();
        // 强制演示模式
      } else {
        if (!Web3.hasWallet()) {
          App.confirm('未检测到钱包插件',
            '当前浏览器未安装 Web3 钱包，无法完成真实签名。是否使用「演示钱包」继续体验完整流程？',
            '使用演示钱包', () => App.doWalletLogin(true));
          return;
        }
        App.toast('请在钱包中确认连接请求…', 'info');
        st = await Web3.connect();
      }
    } catch (e) {
      App.toast('连接失败：' + (e.message || e), 'err');
      return;
    }
    const nonce = Store.uid('n');
    App.toast('请在钱包中对登录信息进行签名…', 'info');
    const sig = await Web3.signLogin(nonce);

    const addr = st.address;
    let user = Store.getUser(addr);
    if (!user) {
      user = Store.upsertUser({
        address: addr,
        name: '创作者 ' + addr.slice(-4).toUpperCase(),
        email: '',
        role: 'user',
        createdAt: new Date().toISOString().slice(0, 10),
        status: 'active',
        bio: '通过钱包签名登录的创作者'
      });
    }
    if (user.status === 'banned') {
      App.toast('该地址已被平台管理员封禁，请联系客服申诉。', 'err', '账号受限');
      return;
    }
    App.login({
      address: addr, name: user.name, role: user.role,
      method: 'wallet', walletMode: st.mode, sig: (sig.signature || '').slice(0, 24)
    });
    App.toast('欢迎回来，' + user.name + '！登录签名：' + (sig.signature || '').slice(0, 12) + '…', 'ok', '登录成功');
    App.renderAuth(); App.refreshNet();
    setTimeout(() => {
      const q = new URLSearchParams(location.search).get('redirect');
      if (q) location.href = App.page(q);
    }, 900);
  };

  /* ---------- 工具：读取 URL ---------- */
  App.q = (k) => new URLSearchParams(location.search).get(k);

  /* ---------- 加载中骨架 ---------- */
  App.skeleton = (n) => Array.from({ length: n || 3 }).map(() =>
    `<div class="card" style="height:230px;opacity:.5;animation:pulse 1.4s infinite"></div>`).join('');

  /* ---------- 页脚 ---------- */
  App.mountFooter = function () {
    document.querySelectorAll('[data-footer]').forEach(el => {
      el.innerHTML = `<div class="container">
        <div class="foot-grid">
          <div>
            <a href="${App.home()}" class="logo"><span class="logo-mark">🛡️</span><span>ChainVault<small>DIGITAL RIGHTS</small></span></a>
            <p class="dim" style="font-size:13.5px;margin-top:12px;max-width:340px">
              基于区块链的数字版权保护与交易平台，为数字艺术、音乐、文学作品提供存证确权、授权管理与版权流转一站式解决方案。
            </p>
            <div class="row mt-16" style="gap:8px">
              <span class="badge info">ERC-721</span><span class="badge cyan">IPFS</span><span class="badge ok">Sepolia</span>
            </div>
          </div>
          <div>
            <h5>产品服务</h5>
            <a href="${App.page('create.html')}">作品确权存证</a>
            <a href="${App.page('works.html')}">版权交易市场</a>
            <a href="${App.page('dashboard.html')}">创作者中心</a>
            <a href="${App.page('admin.html')}">平台管理后台</a>
          </div>
          <div>
            <h5>资源</h5>
            <a href="#" onclick="return false">智能合约白皮书</a>
            <a href="#" onclick="return false">开发者 API 文档</a>
            <a href="#" onclick="return false">版权法律指引</a>
            <a href="#" onclick="return false">司法取证说明</a>
          </div>
          <div>
            <h5>关于</h5>
            <a href="#" onclick="return false">团队介绍</a>
            <a href="#" onclick="return false">合作机构</a>
            <a href="#" onclick="return false">隐私政策</a>
            <a href="#" onclick="return false">服务条款</a>
          </div>
        </div>
        <div class="foot-bot">
          <span>© 2026 ChainVault Digital Rights Protocol · 演示站点，链上数据仅供教学与产品原型演示</span>
          <span class="mono">合约 ${App.fmt.addr(Store.settings().contract, 8)}</span>
        </div>
      </div>`;
    });
  };

  /* ---------- 初始化 ---------- */
  document.addEventListener('DOMContentLoaded', async function () {
    const s = App.session();
    if (s) {
      Object.assign(Web3.state, { connected: true, address: s.address, mode: s.walletMode === 'wallet' ? 'wallet' : 'demo' });
    }
    App.mountFooter();
  });

  global.App = App;
})(window);
