/* ============================================================
 *  ChainVault DApp  ·  数据层 (store.js)
 *  以 localStorage 作为演示用持久化后端，模拟链下索引服务
 *  真实链上数据由 web3.js 负责写入，本层负责业务对象与索引
 * ============================================================ */
(function (global) {
  'use strict';

  const NS = 'chainvault';
  const K = {
    works: NS + ':works',
    users: NS + ':users',
    accounts: NS + ':accounts',
    orders: NS + ':orders',
    licenses: NS + ':licenses',
    session: NS + ':session',
    credits: NS + ':credits',    // 积分余额 { addr: n }
    creditLog: NS + ':creditlog', // 积分流水
    sign: NS + ':sign',          // 签到记录 { addr: {last, streak} }
    daily: NS + ':daily',        // 每日行为计数 { addr: {date, likes} }
    favAward: NS + ':faward',    // 已发放过收藏奖励的作品
    settings: NS + ':settings',
    chain: NS + ':chain',      // 模拟区块高度 / gas 快照
    reviews: NS + ':reviews',  // 作品用户评价
    nego: NS + ':nego',        // 议价会话（买方↔作者消息）
  };

  /* ---------- 基础存储工具 ---------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[store] read fail', key, e);
      return fallback;
    }
  }
  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('[store] write fail', key, e);
    }
  }
  function uid(p) {
    return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- 演示用哈希（不要用于生产密码存储） ---------- */
  function simpleHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  /* ---------- 随机 16 进制串，用于模拟 txhash / 地址 ---------- */
  function hex(len) {
    const s = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < len; i++) out += s[Math.floor(Math.random() * 16)];
    return out;
  }
  const randTx = () => '0x' + hex(64);
  const randAddr = () => '0x' + hex(40);

  /* ============================================================
   *  种子数据
   * ============================================================ */
  const TYPE_MAP = {
    art: { label: '数字艺术品', icon: '🎨', color: 'art' },
    music: { label: '音乐作品', icon: '🎵', color: 'music' },
    literature: { label: '文学作品', icon: '✍️', color: 'lit' },
  };

  const LICENSE_MAP = {
    personal: { label: '个人欣赏授权', base: 0.15, desc: '仅限个人非商业用途欣赏、收藏' },
    commercial: { label: '商用授权', base: 0.6, desc: '可用于广告、包装、影视等商业场景' },
    derivative: { label: '改编权', base: 0.85, desc: '允许二次创作、改编与衍生发行' },
    exclusive: { label: '独家买断', base: 1, desc: '所有权整体转让，作者保留署名权' },
  };

  /* 上架状态：
     pending 审核中 · approved 在售 · rejected 已下架 · owned 买断入库（不在市场展示，由持有人自主决定上架） */
  const STATUS_MAP = {
    approved: { label: '在售', cls: 'ok' },
    pending:  { label: '审核中', cls: 'warn' },
    rejected: { label: '已下架', cls: 'err' },
    owned:    { label: '仓库中 · 未上架', cls: '' },
  };

  const PERIODS = [
    { value: 1, label: '1 年' },
    { value: 3, label: '3 年' },
    { value: 5, label: '5 年' },
    { value: 0, label: '永久' },
  ];

  function seedUsers() {
    return [
      { address: '0x7a3f9c1d4b8e2f6a0c5d8e3b7f1a4c9e2d6b8f03', name: '陈星野', email: 'star@chainvault.io', role: 'user', createdAt: '2026-03-11', status: 'active', bio: '数字绘画创作者，专注赛博东方美学' },
      { address: '0x2b6e8f4a1c9d3e7b5f0a2c8d6e4b1f3a9c7d5e02', name: '林听音', email: 'sound@chainvault.io', role: 'user', createdAt: '2026-04-02', status: 'active', bio: '独立音乐人 / 电子氛围制作' },
      { address: '0x9c4a1f7e3d8b2c6a5f9e1d4b8c3a7f2e6d0b5a91', name: '苏未然', email: 'writer@chainvault.io', role: 'user', createdAt: '2026-05-19', status: 'active', bio: '科幻小说作者，短篇集《硅基夜航》' },
      { address: '0x5d8c2a6f1b9e4d3c7a0f8b5e2d6c1a9f3b7e4c80', name: 'Platform Ops', email: 'ops@chainvault.io', role: 'user', createdAt: '2026-01-08', status: 'active', bio: '平台运营账号' },
      { address: '0x00000000000000000000000000000000000admln', name: '平台管理员', email: 'admin@chainvault.io', role: 'admin', createdAt: '2026-01-01', status: 'active', bio: '超级管理员：拥有平台维护最高权限' },
    ];
  }

  function seedWorks() {
    const base = [
      { id: 'w_1001', title: '赛博敦煌 · 飞天 No.3', type: 'art', author: '陈星野', addr: '0x7a3f9c1d4b8e2f6a0c5d8e3b7f1a4c9e2d6b8f03', price: 2.85, license: 'exclusive', tags: ['国潮', '赛博朋克', '3D'], desc: '以敦煌飞天壁画为母题的数字重构作品，融合金属材质与全息光效，全套共 8 幅，此为上链的第 3 幅。', views: 4128, likes: 326, days: 46 },
      { id: 'w_1002', title: '夜航频率 Ambient EP', type: 'music', author: '林听音', addr: '0x2b6e8f4a1c9d3e7b5f0a2c8d6e4b1f3a9c7d5e02', price: 0.92, license: 'commercial', tags: ['Ambient', '电子', 'EP'], desc: '6 轨环境电子 EP，采样自城市夜间电磁噪声，母带 48kHz/24bit WAV + 立体声混音工程文件。', views: 2870, likes: 214, days: 38 },
      { id: 'w_1003', title: '硅基夜航（短篇集）', type: 'literature', author: '苏未然', addr: '0x9c4a1f7e3d8b2c6a5f9e1d4b8c3a7f2e6d0b5a91', price: 0.35, license: 'derivative', tags: ['科幻', '短篇小说', 'AI'], desc: '12 篇近未来科幻短篇合集，探讨意识上传与数字身份伦理，含影视改编权单独议价通道。', views: 1936, likes: 187, days: 52 },
      { id: 'w_1004', title: '像素山海经 · 卷一', type: 'art', author: '陈星野', addr: '0x7a3f9c1d4b8e2f6a0c5d8e3b7f1a4c9e2d6b8f03', price: 1.64, license: 'commercial', tags: ['像素', '山海经', '插画'], desc: '以 16-bit 像素语言重绘《山海经》异兽 24 幅，附赠分层 PSD 源文件与商用授权证书。', views: 3245, likes: 402, days: 21 },
      { id: 'w_1005', title: '潮汐序曲 Single', type: 'music', author: '林听音', addr: '0x2b6e8f4a1c9d3e7b5f0a2c8d6e4b1f3a9c7d5e02', price: 0.48, license: 'personal', tags: ['钢琴', 'New Age', '单曲'], desc: '钢琴与潮汐采样单曲，时长 4\'12"，含无损音源与乐谱 PDF。', views: 1582, likes: 133, days: 12 },
      { id: 'w_1006', title: '星轨编年史 · 设定集', type: 'literature', author: '苏未然', addr: '0x9c4a1f7e3d8b2c6a5f9e1d4b8c3a7f2e6d0b5a91', price: 0.76, license: 'commercial', tags: ['世界观', '设定集', ' game-ready'], desc: '完整架空世界观设定集 8 万字，包含势力图谱、科技树与年表，适合游戏/影视项目采买。', views: 2210, likes: 265, days: 30 },
      { id: 'w_1007', title: '霓虹雨巷 Motion', type: 'art', author: '陈星野', addr: '0x7a3f9c1d4b8e2f6a0c5d8e3b7f1a4c9e2d6b8f03', price: 3.20, license: 'exclusive', tags: ['动态海报', 'Motion', '城市'], desc: '20 秒循环动态海报，4K ProRes 4444 + Lottie 双版本交付，适用于城市文旅大屏投放。', views: 5204, likes: 588, days: 9 },
      { id: 'w_1008', title: '无声图书馆 BGM Pack', type: 'music', author: '林听音', addr: '0x2b6e8f4a1c9d3e7b5f0a2c8d6e4b1f3a9c7d5e02', price: 1.15, license: 'commercial', tags: ['BGM', '音效包', '商用'], desc: '30 条免版税背景音乐，覆盖纪录片、短视频、播客三类场景，含分轨 stems。', views: 3670, likes: 341, days: 17 },
      { id: 'w_1009', title: 'AI 不会梦见电子羊', type: 'literature', author: '苏未然', addr: '0x9c4a1f7e3d8b2c6a5f9e1d4b8c3a7f2e6d0b5a91', price: 0.58, license: 'derivative', tags: ['中篇', '赛博', '哲学'], desc: '3.2 万字中篇小说，关于仿生人记忆黑市的悬疑叙事，已完结，支持影视/漫画改编授权。', views: 2745, likes: 298, days: 26 },
      { id: 'w_1010', title: '浮世绘 · 波浪再构', type: 'art', author: '陈星野', addr: '0x7a3f9c1d4b8e2f6a0c5d8e3b7f1a4c9e2d6b8f03', price: 1.98, license: 'commercial', tags: ['浮世绘', '版画', '再创作'], desc: '基于葛饰北斋《神奈川冲浪里》的参数化重构，输出 8192px 无损 PNG 与生成工程。', views: 2918, likes: 247, days: 41 },
      { id: 'w_1011', title: '深潜者 Deep Dive', type: 'music', author: '林听音', addr: '0x2b6e8f4a1c9d3e7b5f0a2c8d6e4b1f3a9c7d5e02', price: 0.66, license: 'derivative', tags: ['Downtempo', 'Remix'], desc: ' downtempo 单曲，含 remix 授权包（分轨 + MIDI），支持二次编曲发行。', views: 1340, likes: 121, days: 5 },
      { id: 'w_1012', title: '数字敦煌保护倡议书', type: 'literature', author: 'Platform Ops', addr: '0x5d8c2a6f1b9e4d3c7a0f8b5e2d6c1a9f3b7e4c80', price: 0.12, license: 'personal', tags: ['公益', '白皮书'], desc: '平台发起的数字文化遗产保护联合倡议全文，开放免费阅读，转载需注明出处。', views: 6821, likes: 903, days: 60 },
    ];

    const now = Date.now();
    return base.map((b, i) => {
      const ts = now - b.days * 86400000;
      return {
        id: b.id,
        title: b.title,
        type: b.type,
        desc: b.desc,
        tags: b.tags,
        price: b.price,
        licenseType: b.license,
        owner: b.addr,
        ownerName: b.author,
        creator: b.addr,
        creatorName: b.author,
        fileName: b.title + (b.type === 'music' ? '.wav' : b.type === 'art' ? '.png' : '.pdf'),
        fileSize: (0.8 + Math.random() * 42).toFixed(1) + ' MB',
        hash: '0x' + hex(64),
        txHash: randTx(),
        blockNumber: 21478300 - i * 137 - Math.floor(Math.random() * 90),
        tokenId: 1000 + i,
        createdAt: new Date(ts).toISOString(),
        status: 'approved',
        views: b.views,
        likes: b.likes,
        licenseCount: Math.floor(Math.random() * 9),
        cdn: 'ipfs://bafybei' + hex(38),
      };
    });
  }

  function seedAccounts() {
    return [
      { email: 'admin@chainvault.io', pwd: simpleHash('admin123'), addr: '0x00000000000000000000000000000000000admln', name: '平台管理员', role: 'admin' },
      { email: 'star@chainvault.io', pwd: simpleHash('123456'), addr: '0x7a3f9c1d4b8e2f6a0c5d8e3b7f1a4c9e2d6b8f03', name: '陈星野', role: 'user' },
      { email: 'sound@chainvault.io', pwd: simpleHash('123456'), addr: '0x2b6e8f4a1c9d3e7b5f0a2c8d6e4b1f3a9c7d5e02', name: '林听音', role: 'user' },
      { email: 'demo@chainvault.io', pwd: simpleHash('123456'), addr: '0x5d8c2a6f1b9e4d3c7a0f8b5e2d6c1a9f3b7e4c80', name: '体验用户', role: 'user' },
    ];
  }

  function seedOrders(works) {
    const list = [];
    const pairs = [
      [0, 'exclusive', 2.85, 0], [1, 'commercial', 0.92, 3], [3, 'commercial', 1.64, 1],
      [5, 'personal', 0.76, 1], [6, 'exclusive', 3.20, 0], [7, 'commercial', 1.15, 5],
      [8, 'derivative', 0.58, 3], [2, 'derivative', 0.35, 1], [9, 'commercial', 1.98, 0],
    ];
    pairs.forEach((p, i) => {
      const w = works[p[0]];
      const ts = Date.now() - (i + 1) * 86400000 * 2.2;
      list.push({
        id: 'o_' + (2001 + i),
        workId: w.id,
        workTitle: w.title,
        type: p[1] === 'exclusive' ? 'transfer' : 'license',
        scope: p[1],
        period: p[3],
        amount: p[2],
        buyer: randAddr(),
        buyerName: ['BlueWhale Studio', '星潮传媒', 'Nova Games', '轻舟文化', 'Zenith Lab'][i % 5],
        seller: w.owner,
        sellerName: w.ownerName,
        txHash: randTx(),
        fee: +(p[2] * 0.025).toFixed(4),
        status: 'success',
        createdAt: new Date(ts).toISOString(),
      });
    });
    return list;
  }

  function seedLicenses(works) {
    return works.slice(0, 6).map((w, i) => ({
      id: 'l_' + (3001 + i),
      workId: w.id,
      workTitle: w.title,
      licensee: randAddr(),
      licenseeName: ['星潮传媒', 'Nova Games', '轻舟文化', 'Zenith Lab'][i % 4],
      scope: ['commercial', 'personal', 'derivative'][i % 3],
      period: [1, 3, 5][i % 3],
      price: +(w.price * 0.4).toFixed(3),
      txHash: randTx(),
      createdAt: new Date(Date.now() - (i + 2) * 86400000 * 3).toISOString(),
      expiresAt: [1, 3, 5][i % 3] ? new Date(Date.now() + [1, 3, 5][i % 3] * 365 * 86400000).toISOString() : null,
      status: 'active',
    }));
  }

  /* ---------- 用户评价种子 ---------- */
  function seedReviews(works) {
    const buyers = ['BlueWhale Studio', '星潮传媒', 'Nova Games', '轻舟文化', 'Zenith Lab', '拾光设计', '白露影业'];
    const texts = [
      ['交付质量超出预期，源文件分层清晰，商用落地非常顺利。', 5],
      ['作者响应很快，授权流程全程链上可查，很放心。', 5],
      ['风格独特，团队内部一致好评，后续还会回购。', 5],
      ['整体不错，个别细节和预览略有出入，已与作者沟通解决。', 4],
      ['性价比很高，授权凭证 NFT 直接进了钱包，体验顺畅。', 5],
      ['谈判到交付只用了两天，专业度满分。', 4],
    ];
    const out = [];
    works.forEach((w, wi) => {
      const n = wi < 6 ? 1 + (wi % 2) : (wi % 3 === 0 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const pick = texts[(wi * 2 + i) % texts.length];
        out.push({
          id: 'r_' + (4001 + out.length),
          workId: w.id,
          workTitle: w.title,
          buyer: randAddr(),
          buyerName: buyers[(wi + i) % buyers.length],
          rating: pick[1],
          text: pick[0],
          createdAt: new Date(Date.now() - (wi * 3 + i + 1) * 86400000 * 2.5).toISOString(),
          reply: (wi + i) % 3 === 0 ? '感谢支持！有需要随时联系我，老客户续约享有优先定制通道。' : null,
        });
      }
    });
    return out;
  }

  /* ============================================================
   *  积分规则（CV Point，仅可用于「个人欣赏授权」）
   * ============================================================ */
  const CREDIT = {
    name: '版权积分',
    unit: 'CV',
    rate: 10000,        // 1 ETH = 10000 积分
    signBase: 20,       // 每日签到基础奖励
    signStep: 5,        // 连续签到每日递增
    signMax: 50,        // 单次签到上限
    like: 2,            // 点赞奖励
    likeDaily: 5,       // 每日点赞奖励次数上限
    fav: 5,             // 收藏奖励（每件作品限一次）
    minEth: 0.001,      // 最小兑换额度
    scope: 'personal',  // 仅该授权类型可用积分支付
  };

  /* ============================================================
   *  初始化
   * ============================================================ */
  /* 授权方式由单选迁移为多选（licenseTypes 数组 + personalCredits 积分价） */
  function migrateLicenses() {
    let list = read(K.works, []), changed = false;
    list = list.map(w => {
      if (!w.licenseTypes || !w.licenseTypes.length) {
        w.licenseTypes = w.licenseType ? [w.licenseType] : ['commercial'];
        w.personalCredits = w.personalCredits || Math.max(50, Math.round(Number(w.price || 0.5) * 0.15 * CREDIT.rate));
        changed = true;
      }
      return w;
    });
    if (changed) write(K.works, list);
  }

  function ensureSeed() {
    if (!localStorage.getItem(K.works)) {
      const works = seedWorks();
      write(K.works, works);
      write(K.users, seedUsers());
      write(K.accounts, seedAccounts());
      write(K.orders, seedOrders(works));
      write(K.licenses, seedLicenses(works));
      write(K.chain, { block: 21478800, gasPrice: 12.4, network: 'Ethereum Sepolia', updatedAt: Date.now() });
    }
    if (!localStorage.getItem(K.reviews)) {
      write(K.reviews, seedReviews(read(K.works, [])));
    }
    migrateLicenses();
    if (!localStorage.getItem(K.settings)) {
      write(K.settings, {
        contract: '0x8C4fA1d3E9b27C5e6D0aF8B2c7E1d4A9f3B6c5E70',
        network: 'Ethereum Sepolia',
        chainId: 11155111,
        explorer: 'https://sepolia.etherscan.io',
        royaltyRate: 5,
        platformFee: 2.5,
        autoApprove: false,
        minPrice: 0.01,
        currency: 'ETH',
        maintain: false,
      });
    }
  }
  ensureSeed();

  /* ============================================================
   *  API
   * ============================================================ */
  const Store = {
    NS, K, TYPE_MAP, LICENSE_MAP, PERIODS, STATUS_MAP, simpleHash, randTx, randAddr, uid,

    /* --- 作品 --- */
    works() { return read(K.works, []); },
    saveWorks(list) { write(K.works, list); },
    getWork(id) { return this.works().find(w => w.id === id) || null; },
    addWork(w) { const list = this.works(); list.unshift(w); write(K.works, list); return w; },
    updateWork(id, patch) {
      const list = this.works();
      const i = list.findIndex(w => w.id === id);
      if (i < 0) return null;
      list[i] = Object.assign({}, list[i], patch);
      write(K.works, list);
      return list[i];
    },
    removeWork(id) { write(K.works, this.works().filter(w => w.id !== id)); },
    approveWork(id, ok) {
      return this.updateWork(id, { status: ok ? 'approved' : 'rejected' });
    },

    /* --- 用户 --- */
    users() { return read(K.users, []); },
    saveUsers(list) { write(K.users, list); },
    getUser(addr) { return this.users().find(u => u.address.toLowerCase() === String(addr).toLowerCase()) || null; },
    upsertUser(u) {
      const list = this.users();
      const i = list.findIndex(x => x.address.toLowerCase() === u.address.toLowerCase());
      if (i >= 0) list[i] = Object.assign({}, list[i], u);
      else list.push(Object.assign({ role: 'user', status: 'active', createdAt: new Date().toISOString().slice(0, 10) }, u));
      write(K.users, list);
      return list[i >= 0 ? i : list.length - 1];
    },
    setUserStatus(addr, status) {
      const list = this.users();
      const i = list.findIndex(u => u.address.toLowerCase() === String(addr).toLowerCase());
      if (i >= 0) { list[i].status = status; write(K.users, list); }
      return list[i];
    },

    /* --- 账密 --- */
    accounts() { return read(K.accounts, []); },
    findAccount(email) { return this.accounts().find(a => a.email.toLowerCase() === String(email).toLowerCase()) || null; },
    addAccount(a) { const list = this.accounts(); const rec = Object.assign({ role: 'user' }, a, { pwd: a.pwd }); list.push(rec); write(K.accounts, list); return rec; },

    /* --- 订单 --- */
    orders() { return read(K.orders, []); },
    addOrder(o) { const list = this.orders(); list.unshift(o); write(K.orders, list); return o; },

    /* --- 授权 --- */
    licenses() { return read(K.licenses, []); },
    addLicense(l) { const list = this.licenses(); list.unshift(l); write(K.licenses, list); return l; },

    /* --- 用户评价 --- */
    reviews() { return read(K.reviews, []); },
    reviewsOf(workId) { return this.reviews().filter(r => r.workId === workId); },
    addReview(r) { const list = this.reviews(); list.unshift(r); write(K.reviews, list); return r; },

    /* --- 议价会话 --- */
    negotiations() { return read(K.nego, []); },
    getNegotiation(workId, buyer) {
      return this.negotiations().find(n => n.workId === workId &&
        String(n.buyer).toLowerCase() === String(buyer).toLowerCase()) || null;
    },
    negoById(id) { return this.negotiations().find(n => n.id === id) || null; },
    upsertNegotiation(n) {
      const list = this.negotiations();
      const i = list.findIndex(x => x.workId === n.workId &&
        String(x.buyer).toLowerCase() === String(n.buyer).toLowerCase());
      if (i >= 0) list[i] = n; else list.unshift(n);
      write(K.nego, list);
      return n;
    },
    /* 标记某人已读（who: 'buyer' | 'seller'） */
    markRead(id, who) {
      const n = this.negoById(id);
      if (!n) return null;
      n[who + 'ReadAt'] = new Date().toISOString();
      return this.upsertNegotiation(n);
    },
    /* 某地址在本会话的未读条数 */
    unreadOf(n, addr) {
      const isBuyer = String(n.buyer).toLowerCase() === String(addr).toLowerCase();
      const isSeller = String(n.seller).toLowerCase() === String(addr).toLowerCase();
      if (!isBuyer && !isSeller) return 0;
      const me = isBuyer ? 'buyerReadAt' : 'sellerReadAt';
      const from = isBuyer ? 'seller' : 'buyer';
      const last = n[me] ? Date.parse(n[me]) : 0;
      return (n.messages || []).filter(m => m.from === from && Date.parse(m.at) > last).length;
    },
    /* 某地址的全部未读（条数 + 涉及会话数） */
    unreadFor(addr) {
      const list = this.negotiations().filter(n =>
        String(n.buyer).toLowerCase() === String(addr).toLowerCase() ||
        String(n.seller).toLowerCase() === String(addr).toLowerCase());
      let count = 0, sessions = 0;
      list.forEach(n => {
        const c = this.unreadOf(n, addr);
        if (c > 0) { count += c; sessions++; }
      });
      return { count, sessions };
    },
    /* 某地址参与的会话（按最后消息时间倒序） */
    threadsOf(addr) {
      return this.negotiations().filter(n =>
        String(n.buyer).toLowerCase() === String(addr).toLowerCase() ||
        String(n.seller).toLowerCase() === String(addr).toLowerCase())
        .map(n => {
          const msgs = n.messages || [];
          const last = msgs.length ? msgs[msgs.length - 1] : null;
          return Object.assign({}, n, {
            _lastAt: last ? Date.parse(last.at) : Date.parse(n.createdAt || 0),
            _unread: this.unreadOf(n, addr),
          });
        }).sort((a, b) => b._lastAt - a._lastAt);
    },

    /* --- 作者自动回复 --- */
    autoReplyOf(addr) {
      const u = this.getUser(addr);
      return (u && u.autoReply) || { enabled: false, text: '' };
    },
    setAutoReply(addr, obj) {
      return this.upsertUser({ address: addr, autoReply: obj });
    },

    /* ================= 积分 ================= */
    CREDIT,
    credits() { return read(K.credits, {}); },
    creditsOf(addr) { return Number(this.credits()[String(addr).toLowerCase()] || 0); },
    addCredits(addr, amount, type, note) {
      const c = this.credits(), k = String(addr).toLowerCase();
      c[k] = Number(c[k] || 0) + amount;
      write(K.credits, c);
      const log = read(K.creditLog, []);
      log.unshift({ id: 'c_' + Date.now() + Math.random().toString(36).slice(2, 5), addr: k, amount, type, note: note || '', at: new Date().toISOString() });
      write(K.creditLog, log.slice(0, 400));
      return c[k];
    },
    spendCredits(addr, amount, note) {
      if (this.creditsOf(addr) < amount) return false;
      this.addCredits(addr, -amount, 'spend', note);
      return true;
    },
    creditLog(addr) {
      const list = read(K.creditLog, []);
      return addr ? list.filter(l => l.addr === String(addr).toLowerCase()) : list;
    },
    /* 签到 */
    signInfo(addr) {
      const s = read(K.sign, {}), k = String(addr).toLowerCase();
      const today = new Date().toISOString().slice(0, 10);
      const rec = s[k] || { last: '', streak: 0 };
      return { signed: rec.last === today, last: rec.last, streak: rec.streak, today };
    },
    signIn(addr) {
      const info = this.signInfo(addr);
      if (info.signed) return { ok: false, reason: '今日已签到' };
      const k = String(addr).toLowerCase();
      const s = read(K.sign, {});
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const streak = (s[k] && s[k].last === yesterday) ? (s[k].streak || 0) + 1 : 1;
      const amount = Math.min(CREDIT.signMax, CREDIT.signBase + (streak - 1) * CREDIT.signStep);
      s[k] = { last: info.today, streak };
      write(K.sign, s);
      this.addCredits(addr, amount, 'sign', '每日签到 · 连续 ' + streak + ' 天');
      return { ok: true, amount, streak };
    },
    /* 点赞（每日有上限） */
    likeAward(addr) {
      const k = String(addr).toLowerCase();
      const d = read(K.daily, {}), today = new Date().toISOString().slice(0, 10);
      const rec = (d[k] && d[k].date === today) ? d[k] : { date: today, likes: 0 };
      if (rec.likes >= CREDIT.likeDaily) return { ok: false, reason: '今日点赞奖励已达上限（' + CREDIT.likeDaily + ' 次）' };
      rec.likes++; d[k] = rec; write(K.daily, d);
      this.addCredits(addr, CREDIT.like, 'like', '点赞作品');
      return { ok: true, amount: CREDIT.like, left: CREDIT.likeDaily - rec.likes };
    },
    likeLeft(addr) {
      const k = String(addr).toLowerCase();
      const d = read(K.daily, {}), today = new Date().toISOString().slice(0, 10);
      const rec = (d[k] && d[k].date === today) ? d[k] : { likes: 0 };
      return Math.max(0, CREDIT.likeDaily - rec.likes);
    },
    /* 收藏（每件作品仅一次） */
    favAward(addr, workId) {
      const k = String(addr).toLowerCase() + '|' + workId;
      const list = read(K.favAward, []);
      if (list.indexOf(k) >= 0) return { ok: false, reason: '该作品已发放过收藏奖励' };
      list.push(k); write(K.favAward, list);
      this.addCredits(addr, CREDIT.fav, 'fav', '收藏作品');
      return { ok: true, amount: CREDIT.fav };
    },
    /* ETH 兑换积分 */
    ethToCredit(eth) { return Math.round(Number(eth) * CREDIT.rate); },
    buyCredits(addr, eth, note) {
      const amount = this.ethToCredit(eth);
      if (amount <= 0) return { ok: false, reason: '兑换金额过低' };
      this.addCredits(addr, amount, 'buy', note || ('ETH 兑换 · ' + eth + ' ETH'));
      return { ok: true, amount, eth };
    },

    /* --- 会话 --- */
    session() { return read(K.session, null); },
    setSession(s) { write(K.session, s); },
    clearSession() { localStorage.removeItem(K.session); },

    /* --- 设置 --- */
    settings() { return read(K.settings, {}); },
    saveSettings(s) { write(K.settings, Object.assign(this.settings(), s)); },

    /* --- 链快照 --- */
    chain() { return read(K.chain, { block: 21478800, gasPrice: 12.4 }); },
    bumpChain() {
      const c = this.chain();
      c.block += Math.floor(Math.random() * 12) + 1;
      c.gasPrice = +(8 + Math.random() * 22).toFixed(1);
      c.updatedAt = Date.now();
      write(K.chain, c);
      return c;
    },

    /* --- 演示数据重置 --- */
    reset() {
      Object.values(K).forEach(k => localStorage.removeItem(k));
      ensureSeed();
    },
  };

  global.Store = Store;
})(window);
