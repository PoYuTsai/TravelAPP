# NPM 依賴漏洞風險評估

**日期**: 2026-03-16
**評估者**: Claude Code
**起始漏洞數**: 33 (1 critical, 14 high, 18 moderate)
**修復後漏洞數**: 22 (0 critical, 8 high, 14 moderate)

## 已修復

### 透過 `npm audit fix`（無 breaking changes）

| 套件 | 嚴重度 | 漏洞類型 | 狀態 |
|------|--------|----------|------|
| basic-ftp | Critical | Path Traversal | ✅ 已修復 |
| @isaacs/brace-expansion | High | Uncontrolled Resource Consumption | ✅ 已修復 |
| ajv | Moderate | ReDoS | ✅ 已修復 |
| dompurify | Moderate | XSS | ✅ 已修復 |
| flatted | High | DoS | ✅ 已修復 |
| rollup | High | Path Traversal | ✅ 已修復 |
| tar | High | Path Traversal | ✅ 已修復 |
| minimatch (部分) | High | ReDoS | ✅ 部分修復 |

### 透過 npm overrides

| 套件 | 嚴重度 | 覆蓋版本 | 狀態 |
|------|--------|----------|------|
| undici | High | ^7.24.4 | ✅ 已修復 |

## 剩餘漏洞風險評估

### 1. glob CLI Command Injection (High)

**影響套件**: @architect/*, @sanity/runtime-cli, @sanity/cli
**修復方式**: 升級 sanity@5.16.0 (major version bump)

**風險評估**: 🟡 **低風險**
- 此漏洞僅影響 CLI 使用（`-c/--cmd` 參數）
- 不影響網站 runtime
- Sanity Studio 在瀏覽器運行，不使用 CLI
- 只有開發者本機執行 `sanity` CLI 時才有風險

**建議**:
- 開發者注意不要執行不受信任的 CLI 命令
- 等 Sanity v5 穩定後再升級

### 2. Next.js DoS 漏洞 (High)

**漏洞 1**: GHSA-9g9p-9gw9-jx7f (Image Optimizer remotePatterns DoS)
**漏洞 2**: GHSA-h25m-26qc-wcjf (HTTP request deserialization DoS in RSC)

**修復方式**: 升級 next@16.1.6 (major version bump)

**風險評估**: 🟡 **低至中風險**

**Image Optimizer 漏洞**:
- 網站使用 `remotePatterns` 設定 (`cdn.sanity.io`, `img.youtube.com`)
- 攻擊者需能發送特製請求到 `/_next/image`
- Vercel/Cloudflare 等 hosting 平台通常有額外防護
- 可透過 rate limiting 緩解

**RSC 漏洞**:
- 本站 **未使用** React Server Components
- 無 `"use server"` directive
- 無 Server Actions
- **此漏洞不適用於本站**

**建議**:
- 在 Vercel 部署時，Image Optimizer 有額外保護
- 監控 Next.js 14.x 是否會有 patch 版本修復
- 評估 Next.js 15/16 升級的 breaking changes

### 3. prismjs DOM Clobbering (Moderate)

**影響套件**: prismjs → refractor → react-refractor → @sanity/ui
**修復方式**: 升級 sanity@5.16.0

**風險評估**: 🟢 **極低風險**
- 僅影響 Sanity Studio 的程式碼高亮功能
- Studio 已有身份驗證保護
- 攻擊者需先取得 Studio 存取權
- DOM Clobbering 需要特定的 HTML 注入情境

**建議**: 等 Sanity v5 穩定後一併升級

### 4. yauzl Off-by-one Error (Moderate)

**影響套件**: yauzl → extract-zip → @puppeteer/browsers → puppeteer
**修復方式**: 降級 puppeteer-core@19.8.3

**風險評估**: 🟢 **極低風險**
- 僅在 PDF 生成時使用 Puppeteer
- 不處理使用者上傳的 zip 檔案
- 在伺服器端執行，無使用者直接存取

**建議**: 可考慮降級 puppeteer，但影響其他功能的風險

### 5. @actions/github undici 漏洞 (High)

**風險評估**: 🟢 **不適用**
- 這是 GitHub Actions 套件
- 僅在 CI/CD 環境使用
- 不影響網站 runtime

## 緩解措施

### 已實施

1. **npm overrides** - 強制 undici 升級到安全版本
2. **CSP headers** - 限制腳本和連線來源
3. **Rate limiting** - API 端點有請求限制
4. **身份驗證** - Studio 和敏感 API 有認證保護

### 建議實施

1. **Image Optimizer 監控** - 監控 `/_next/image` 異常請求
2. **定期檢查** - 每月執行 `npm audit` 並評估新漏洞
3. **升級規劃** - 排程 Sanity v5 和 Next.js 16 升級評估

## 升級路徑評估

### Sanity 3.x → 5.x

**Breaking Changes 預期**:
- API 變更
- Plugin 相容性
- Schema 定義可能需調整

**建議時機**: Sanity v5 GA 後 1-2 個月，確認生態系穩定

### Next.js 14.x → 16.x

**Breaking Changes 預期**:
- App Router 變更
- Middleware 變更
- 部署設定可能需調整

**建議時機**: 評估升級成本後，規劃 sprint 處理

## 結論

目前剩餘的 22 個漏洞中：
- **8 個 high** - 大部分在 CLI 工具或不適用於本站架構
- **14 個 moderate** - 主要在開發工具或有額外防護的區域

**整體風險**: 🟡 **可接受**

本站已有多層防護（CSP、認證、rate limiting），且大部分高風險漏洞不影響 production 網站運行。建議：

1. 維持現狀，持續監控
2. 規劃 Q2 進行 Sanity/Next.js 主要版本升級
3. 每月檢查是否有 patch 版本可用
