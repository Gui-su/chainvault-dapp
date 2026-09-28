/* ============================================================
 *  ChainVault DApp  ·  Web3 层 (web3.js)
 *  优先使用 ethers v6 与浏览器钱包真实交互；
 *  未安装钱包 / CDN 不可用时，自动降级为「演示钱包」，
 *  保证所有业务流程（确权 / 授权 / 交易）仍然可完整体验。
 * ============================================================ */
(function (global) {
  'use strict';

  /* 演示版权存证合约 ABI（与 CopyrightRegistry.sol 对应） */
  const REGISTRY_ABI = [
    'function registerWork(bytes32 contentHash, string uri, uint8 licenseType) returns (uint256 tokenId)',
    'function transferCopyright(uint256 tokenId, address to) returns (bool)',
    'function grantLicense(uint256 tokenId, address licensee, uint8 scope, uint256 expiresAt) returns (uint256 licenseId)',
    'function revokeLicense(uint256 licenseId) returns (bool)',
    'function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 amount)',
    'function verifyHash(bytes32 contentHash) view returns (bool exists, uint256 tokenId, address owner, uint256 timestamp)',
    'event WorkRegistered(uint256 indexed tokenId, address indexed author, bytes32 contentHash, uint256 timestamp)',
    'event LicenseGranted(uint256 indexed licenseId, uint256 indexed tokenId, address licensee, uint256 expiresAt)'
  ];

  const CONTRACT_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ChainVault 数字版权存证与授权合约
contract CopyrightRegistry {
    enum LicenseScope { Personal, Commercial, Derivative, Exclusive }

    struct Work {
        address creator;
        address owner;
        bytes32 contentHash;
        string  metadataURI;   // IPFS
        uint256 createdAt;
        bool    exists;
    }

    mapping(uint256 => Work) public works;
    mapping(bytes32 => uint256) public hashToTokenId;
    uint256 public totalWorks;

    event WorkRegistered(uint256 indexed tokenId, address indexed author, bytes32 contentHash, uint256 timestamp);
    event LicenseGranted(uint256 indexed licenseId, uint256 indexed tokenId, address licensee, uint256 expiresAt);

    function registerWork(bytes32 contentHash, string calldata metadataURI)
        external returns (uint256 tokenId)
    {
        require(hashToTokenId[contentHash] == 0, "already registered");
        tokenId = ++totalWorks;
        works[tokenId] = Work(msg.sender, msg.sender, contentHash, metadataURI, block.timestamp, true);
        hashToTokenId[contentHash] = tokenId;
        emit WorkRegistered(tokenId, msg.sender, contentHash, block.timestamp);
    }

    function transferCopyright(uint256 tokenId, address to) external returns (bool) {
        Work storage w = works[tokenId];
        require(w.exists && w.owner == msg.sender, "not owner");
        w.owner = to;
        return true;
    }

    function grantLicense(uint256 tokenId, address licensee, LicenseScope scope, uint256 expiresAt)
        external returns (uint256)
    { /* 仅所有者可授权，返回授权凭证 ID */ }
}`;

  const state = {
    ethers: null,
    provider: null,
    signer: null,
    mode: 'demo',        // 'wallet' | 'demo'
    connected: false,
    address: null,
    chainId: null,
  };

  const listeners = [];
  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

  /* 资源基准路径：从当前脚本 src 推导，兼容根目录页与 pages/ 子页 */
  const BASE = (function () {
    try {
      const src = document.currentScript && document.currentScript.src;
      if (src) return src.replace(/assets\/js\/web3\.js.*$/, '');
    } catch (e) { /* ignore */ }
    return /\/pages\//.test(location.pathname.replace(/\\/g, '/')) ? '../' : '';
  })();

  function tryScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(global.ethers || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  /* 优先加载本地 ethers（离线 / CDN 被墙也能用），失败再回退 CDN */
  async function loadEthers() {
    if (global.ethers) return global.ethers;
    let e = await tryScript(BASE + 'assets/js/ethers.umd.min.js');
    if (e) return e;
    return await tryScript('https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js');
  }

  function hex(len) { const s = '0123456789abcdef'; let o = ''; for (let i = 0; i < len; i++) o += s[Math.floor(Math.random() * 16)]; return o; }

  /* 演示钱包：生成一个稳定的本地身份 */
  function demoAddress() {
    let a = localStorage.getItem('chainvault:demoaddr');
    if (!a) {
      a = '0x' + hex(40);
      localStorage.setItem('chainvault:demoaddr', a);
    }
    return a;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  const Web3 = {
    REGISTRY_ABI, CONTRACT_SOL, state,

    onChange(fn) { listeners.push(fn); return fn; },

    get mode() { return state.mode; },
    get connected() { return state.connected; },
    get address() { return state.address; },

    hasWallet() { return typeof global.ethereum !== 'undefined'; },
    walletName() {
      if (!global.ethereum) return '';
      if (global.ethereum.isMetaMask) return 'MetaMask';
      if (global.ethereum.isCoinbaseWallet) return 'Coinbase Wallet';
      if (global.ethereum.isTrust) return 'Trust Wallet';
      return '浏览器钱包';
    },

    /* 连接钱包：真实优先，失败降级 */
    async connect() {
      let ethers = await loadEthers();
      if (ethers && global.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(global.ethereum);
          const accounts = await provider.send('eth_requestAccounts', []);
          const net = await provider.getNetwork();
          const signer = await provider.getSigner();
          Object.assign(state, {
            ethers, provider, signer, mode: 'wallet', connected: true,
            address: accounts[0], chainId: Number(net.chainId)
          });
          this._bindEvents();
          emit();
          return state;
        } catch (e) {
          console.warn('[web3] 钱包连接失败，切换演示模式', e);
        }
      }
      await wait(600);
      Object.assign(state, {
        ethers: ethers || null, provider: null, signer: null,
        mode: 'demo', connected: true, address: demoAddress(), chainId: 11155111
      });
      emit();
      return state;
    },

    _bindEvents() {
      if (global.ethereum && !this._bound) {
        this._bound = true;
        global.ethereum.on('accountsChanged', (accs) => {
          if (accs.length) { state.address = accs[0]; emit(); }
          else { this.disconnect(); }
        });
        global.ethereum.on('chainChanged', (cid) => { state.chainId = parseInt(cid, 16); emit(); });
      }
    },

    disconnect() {
      Object.assign(state, { provider: null, signer: null, connected: false, address: null, mode: 'demo' });
      emit();
    },

    /* 恢复会话中的连接（不弹窗） */
    async silentConnect() {
      const s = Store.session();
      if (s && s.address) {
        Object.assign(state, { mode: s.walletMode || 'demo', connected: true, address: s.address, chainId: 11155111 });
        emit();
        return state;
      }
      return null;
    },

    async balance() {
      if (state.mode === 'wallet' && state.ethers && state.address) {
        try {
          const b = await state.provider.getBalance(state.address);
          return Number(state.ethers.formatEther(b)).toFixed(4);
        } catch (e) { /* ignore */ }
      }
      return (Math.random() * 8 + 1.2).toFixed(4);
    },

    chainLabel() {
      const s = Store.settings();
      const map = { 1: 'Ethereum 主网', 11155111: 'Ethereum Sepolia', 137: 'Polygon', 56: 'BNB Chain', 8453: 'Base' };
      return state.mode === 'wallet' ? (map[state.chainId] || 'ChainID ' + state.chainId) : s.network;
    },

    /* ---------------- 链上动作（mock tx 流程） ---------------- */
    async sendTx(action, payload) {
      const gasEth = (Math.random() * 0.0016 + 0.0004).toFixed(6);
      if (state.mode === 'wallet' && state.signer) {
        try {
          const tx = await state.signer.sendTransaction({
            to: Store.settings().contract,
            value: state.ethers.parseEther(String(payload.value || 0)),
            data: state.ethers.hexlify(state.ethers.toUtf8Bytes(JSON.stringify({ action, ...payload })))
          });
          const receipt = await tx.wait();
          Store.bumpChain();
          return { hash: tx.hash, block: receipt.blockNumber, gas: gasEth, wait: async () => receipt };
        } catch (e) {
          console.warn('[web3] 真实交易失败，回退演示模式', e);
        }
      }
      await wait(1200);
      const fake = { hash: '0x' + hex(64), block: Store.bumpChain().block, gas: gasEth };
      return Object.assign(fake, { wait: async () => fake });
    },

    /* 钱包签名登录（SIWE 风格） */
    async signLogin(nonce) {
      const msg = `ChainVault 版权平台登录验证\n\n地址: ${state.address}\n随机数: ${nonce}\n签署时间: ${new Date().toLocaleString('zh-CN')}`;
      if (state.mode === 'wallet' && state.signer) {
        try { return { message: msg, signature: await state.signer.signMessage(msg) }; }
        catch (e) { console.warn('[web3] 签名取消', e); }
      }
      await wait(700);
      return { message: msg, signature: '0x' + hex(130) };
    },

    contract() {
      const s = Store.settings();
      return { address: s.contract, abi: REGISTRY_ABI };
    },
    explorerTx(hash) { return Store.settings().explorer + '/tx/' + hash; },
    explorerAddr(a) { return Store.settings().explorer + '/address/' + a; },
  };

  global.Web3 = Web3;
})(window);
