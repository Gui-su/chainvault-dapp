# ChainVault · 数字版权保护 DApp

面向**数字艺术品 / 音乐 / 文学作品**的确权、授权与交易一体化 Web3 应用原型。作品在本地生成 SHA-256 指纹后上链存证，授权规则与版税分账由智能合约执行，平台端提供完整的创作者后台与管理员维护平台。

## 快速预览

```bash
# 任意静态服务器均可，推荐用本地服务而非直接双击打开（file:// 下浏览器会限制本地存储）
python -m http.server 8123
# 打开 http://localhost:8123/index.html
```

> 直接双击 `index.html` 也能看，但 `localStorage` 在 `file://` 协议下可能被浏览器限制，建议用上面的方式启动。

## 演示账号

| 角色 | 邮箱 | 密码 | 权限 |
| --- | --- | --- | --- |
| 平台管理员 | `admin@chainvault.io` | `admin123` | 管理后台全部权限 |
| 创作者 | `star@chainvault.io` | `123456` | 确权、上架、交易 |
| 创作者 | `sound@chainvault.io` | `123456` | 确权、上架、交易 |
| 体验用户 | `demo@chainvault.io` | `123456` | 购买授权 |

未安装浏览器钱包时，在登录页点「演示钱包登录」即可用本地地址完整体验全部流程；安装 MetaMask 后同一套页面会走真实签名（SIWE 风格的非对称签名登录）。

## 部署上线（公网可访问 + 钱包可用）

> ⚠️ **必须 HTTPS**。浏览器只在「安全上下文」（`https://` 或 `localhost`）下开放 Web Crypto（`crypto.subtle`），
> 本项目的 SHA-256 指纹计算依赖它；同时非 HTTPS 页面上的钱包交互、混合内容加载都会被浏览器或钱包拦截。
> 直接双击 `index.html` 用 `file://` 打开时，钱包扩展与本地存储都会受限，请勿用这种方式演示。

### 方案一：静态托管（推荐，免费 + 自动 HTTPS）

本项目无构建步骤，整个目录即静态站点，直接上传即可。

```bash
# Vercel
npm i -g vercel && cd copyright-dapp && vercel --prod

# Netlify（也可在网页端把文件夹拖进去）
npm i -g netlify-cli && netlify deploy --prod --dir .

# Cloudflare Pages：网页端 Create project → Upload assets，选择整个 copyright-dapp 目录
```

### 方案二：GitHub Pages（免费 HTTPS，推荐长期）

1. 在 github.com 新建仓库，**可见性选 Public**（免费账号的私有仓库不支持 Pages）
2. 推送代码：

```bash
cd copyright-dapp
git init && git add -A && git commit -m "deploy"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

> Windows 上 `git push` 会弹出 GitHub 登录；若开了两步验证，密码处要填
> **Personal Access Token**（GitHub → Settings → Developer settings → Tokens(classic)，勾选 `repo`）。

3. 仓库 **Settings → Pages → Build and deployment**：
   Source = `Deploy from a branch`，Branch = `main`，Folder = `/ (root)` → Save
4. 等 1~3 分钟，访问 `https://<用户名>.github.io/<仓库名>/`

说明：
- 仓库根已放 `.nojekyll`，避免 Jekyll 处理导致资源 404
- 站点全站使用相对路径，部署在子路径（`/<仓库名>/`）下无需改配置
- 若仓库名取 `<用户名>.github.io`，则直接用 `https://<用户名>.github.io/` 访问
- `测试账号.txt` 已写入 `.gitignore`，不会被提交到公开仓库

### 方案三：自有服务器（Nginx + Let's Encrypt）

```nginx
server {
  listen 80;
  server_name dapp.example.com;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl http2;
  server_name dapp.example.com;
  root /var/www/copyright-dapp;
  index index.html;
  ssl_certificate     /etc/letsencrypt/live/dapp.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/dapp.example.com/privkey.pem;
  location / { try_files $uri $uri/ /index.html; }
}
```

```bash
certbot --nginx -d dapp.example.com      # 申请并自动续期证书
```

### 方案四：临时演示（内网穿透）

```bash
python -m http.server 8123        # 先本地起服务
ngrok http 8123                   # 或 cpolar http 8123 / frp
```

隧道会给一个临时 HTTPS 域名，适合快速给同事演示；缺点是每次重启地址会变（ngrok 免费版），不适合长期使用。

### 钱包连接注意事项

1. **ethers 已本地化**：`assets/js/ethers.umd.min.js` 随项目一起部署，`web3.js` 优先加载本地文件、失败才回退 CDN，
   避免因 CDN 被墙或离线导致"加载不出 ethers → 只能演示模式"。
2. **网络一致性**：默认合约在 Ethereum Sepolia 测试网，钱包需切到同一网络；上主网请在管理后台
   「系统设置」中修改合约地址、网络与区块浏览器地址。
3. **移动端**：iOS/Android 的普通浏览器没有扩展，需用 MetaMask App 内置浏览器打开，或接入 WalletConnect
   （需到 cloud.walletconnect.com 申请 projectId 后接入 SDK，当前按钮为演示占位）。
4. **不要被 iframe 嵌套**：部分钱包会拒绝在第三方页面嵌入的站点里弹窗，部署时不要放在 `iframe` 里。
5. **域名要稳定**：频繁更换域名会让钱包的风控提示与用户信任度变差。

## 页面结构

```
index.html              首页：价值主张 / 数据概览 / 核心能力 / 上链流程 / 精选作品 / FAQ
pages/login.html        登录注册：钱包签名登录 + 邮箱账号登录
pages/works.html        版权市场：品类、授权方式、排序的组合筛选
pages/create.html       确权登记：本地 SHA-256 + IPFS 元数据 + 五步上链动效
pages/detail.html       作品详情：链上存证、授权购买、走私指纹校验、侵权举证
pages/messages.html     消息中心：买家议价消息直达作者收件箱，作者可回复 / 设置自动回复
pages/dashboard.html    创作者中心：我的作品/授权/交易/钱包/账号设置
pages/admin.html        管理后台：数据看板、作品审核、用户管理、交易监控、系统设置、审计日志
assets/css/style.css    深色科技风设计系统
assets/js/store.js      数据层：作品/用户/订单/授权 + localStorage 持久化 + 种子数据
assets/js/web3.js       Web3 层：ethers v6 钱包连接、签名登录、合约 ABI 与交易封装
assets/js/app.js        UI 层：导航、Toast、Modal、鉴权守卫、格式化工具
```

## 已实现的核心链路

- **确权**：拖入文件 → 浏览器本地计算 SHA-256 → 填写作品元数据 → 选择授权方式与售价 → `registerWork` 上链 → 生成存证证书（可下载）
- **授权**：四类授权模板（个人欣赏 / 商用 / 改编 / 独家买断）× 四种期限，费用与期限实时联动计算，成交后铸造 License NFT 并写入流转记录
- **交易**：托管 + 原子交割，买断场景自动完成 Ownership 转移，普通场景加权至被授权方钱包
- **核验**：上传任意文件即可与链上指纹做一致性比对，输出司法可用的举证包
- **管理**：作品审核队列、用户封禁/解禁/角色变更、授权吊销、交易流水监控、合约与费率参数维护、操作审计留痕

## 与真实链对接

1. 部署 `assets/js/web3.js` 顶部注释对应的 `CopyrightRegistry.sol`（Sepolia 或其他 EVM 链）
2. 在管理后台「系统设置」中填入真实合约地址、网络、区块浏览器与费率
3. `Web3.connect()` 会优先使用 `ethers.BrowserProvider` 与 `window.ethereum` 交互；真实交易走 `signer.sendTransaction`，确权/授权/转移分别对应合约的 `registerWork` / `grantLicense` / `transferCopyright`
4. 未检测到钱包或交易失败时自动降级为演示模式，保证流程不断裂

> 当前版本为产品原型：链下索引、检索与审核由 localStorage 模拟，真实部署时应替换为后端索引服务（监听合约事件写入数据库）。
