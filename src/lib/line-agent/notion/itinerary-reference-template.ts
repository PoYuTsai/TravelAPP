/**
 * itinerary-reference-template.ts — 開閘前必修 I-1 / I-2（2026-06-15 whole-feature review）。
 *
 * 排行程 low_confidence fallback 的手工骨架，**inline 成 TS 常數**（不再 readFileSync docs/**）：
 *
 *  - I-2（runtime 可達性）：Vercel lambda 的 cwd / file tracing 不保證打包 `docs/**`，
 *    `readFileSync` 會 throw；responder 的 fail-open 雖不崩，卻會在「無命中」(語料早期最常見)
 *    時讓安全網靜默消失、LLM 從零亂編——正是範本要防的事。inline 消除檔案相依。
 *  - I-1（curated 乾淨範本）：本常數原為 low_confidence fallback 的注入骨架，與真案例 snippet
 *    共走同一 `sanitizeItinerarySnippet` assert。2026-06-17 golden 範本反轉（itinerary-reference-source.ts
 *    `selectItineraryReference`）後，注入主幹改為 `goldenTrunk()`（兩套 GOLDEN_*），`templateSkeleton()`
 *    已移除；本常數現僅保留為 curated 乾淨參照（由下方 drift-guard 鎖死），sanitizer assert 只套在
 *    真案例 snippet（見 itinerary-reference.ts `toItineraryReference`）。常數已 curated 乾淨，不會 fail-closed。
 *  - M-3（維持無敬稱/無航班碼）：未來編輯本常數**必須**維持
 *      無具體航班碼（會抵銷 Task 7「不臆造航班、標待確認」、且同字串在真案例會被 drop）、
 *      無 `**` / `#` markdown 強調（會誘發 customer_itinerary_v1 gate 擋格式、拉高 degrade 率）、
 *      無敬稱姓氏（`先生/小姐/太太/一家`，否則過 sanitizer 時整筆 fail-closed → fallback 靜默失效）。
 *    這三條由 itinerary-reference-template.test.ts 的 drift-guard 鎖死，違反即測試紅。
 *
 * 內容鏡像 docs/ai-agent-knowledge/cases/itinerary-templates/chiang-mai-family-5d4n-classic.md
 * 的日程骨架（刻意去掉該 doc 的 `#`/`>` 文件 chrome 與 Retrieval Hints meta，只留可注入的活動骨架；
 * 並把原 body 的具體航班碼 BR257/BR258 改為「待確認」、移除 `**` 粗體）。兩處須同步維持乾淨。
 */
/**
 * **無生產 consumer**（2026-06-17 holistic review M-1）：T2 golden 範本反轉後，
 * 排行程注入主幹改走 `goldenTrunk()`（itinerary-reference-source.ts），不再經本骨架；
 * 本常數目前僅由自身的 itinerary-reference-template.test.ts drift-guard 引用，
 * 作為 curated 乾淨參照保留（不刪——drift-guard 仍鎖死其乾淨度）。
 */
export const ITINERARY_TEMPLATE_SKELETON = `<套餐訂製>清邁親子5天4夜經典套餐
Day 1｜抵達清邁・放鬆展開旅程
・機場接機（早班抵達，航班待確認）
・Nakhonping Exchange 換匯
午餐：Neng's Clay Oven Roasted Pork – Muang Mai Market（清邁必吃脆皮豬）
・泰服體驗 1 小時，請專業攝影師拍攝（古城塔配門/柴迪隆寺，需統計女生幾位化妝）
・芒果糯米飯（下午茶點心）
晚餐：Kung Yim Shop (2nd Branch)（泰國蝦吃到飽）
・住宿：
Day 2｜大象互動 + 黏黏瀑布
8:00 出發
・大象保護營（洗澡 + 做大象午餐 + 餵食 + 跟象拍照）
午餐：營區附近好吃的泰式熱炒
・黏黏瀑布
晚餐：Samsen Villa（米其林）
・人妖秀（Miracle Cabaret Chiang Mai，20:00 開始表演）
・住宿：
Day 3｜水上樂園 + 夜間動物園
8:00 出發
・清邁大峽谷水上樂園
午餐：水上樂園區裡用餐
・藝術村（Baan Kang Wat，禮拜二沒開）
・夜間動物園
晚餐：黑森林餐廳（禮拜三沒開）
・住宿：
Day 4｜湄林親子活動
8:30 出發
・鳳凰冒險公園 Phoenix Adventure
午餐：The Kad Farang Mae Rim
・蛇園表演
・豬豬溜滑梯
・Big C 採買紀念品
晚餐：清邁康托克帝王餐晚宴＆文化表演秀
・住宿：
Day 5｜收心慢遊・送機回國
早餐後退房，送機（回程航班待確認）
・安排送機服務，結束愉快又充實的泰北親子旅程
午餐：
晚餐：
・住宿：`

/**
 * GOLDEN_CHIANGMAI_FAMILY_5D4N — 清邁親子 5 天 4 夜 golden 標準範本。
 *
 * 來源：design 2026-06-17 §4.1（docs/plans/2026-06-17-line-agent-itinerary-golden-template-design.md）。
 * 內容逐字取自 Eric 手工招牌套餐設計（保留原換行、航班碼、`**` 強調等內文），
 * 作為行程類輸出的**架構/格式標準**——客人無特殊需求時可近乎照貼，只換日期/人數 header。
 *
 * 注意：本常數與 ITINERARY_TEMPLATE_SKELETON 不同——這是「權威範本」（保留具體航班/markdown），
 * 不是 sanitizer 路徑的 fallback 骨架，故**不**受 itinerary-reference-template.test.ts 的
 * 無航班碼 / 無 markdown drift-guard 約束。Day 1..Day 5 連續標題與「日期/人數」占位為下游 hard dependency。
 */
export const GOLDEN_CHIANGMAI_FAMILY_5D4N = `<清邁5天4夜>
📅 日期：2026//～/
👨‍👩‍👧‍👦 人數：幾大幾小（幾歲，身高，需不需要兒童座椅，有無長輩，有無特殊備註事項）

Day 1｜抵達清邁・放鬆展開旅程
・機場接機 (長榮 BR257 7:20~10:35)
・Nakhonping Exchange換匯
午餐：Neng's Clay Oven Roasted Pork – Muang Mai Market (清邁必吃脆皮豬)
・泰服體驗1小時，請專業攝影師拍攝 (古城塔配門/柴迪隆寺，統計女生幾位化妝)
・芒果糯米飯 (下午茶點心)
晚餐: Kung Yim Shop (2nd Branch) (泰國蝦吃到飽)
・住宿：

Day 2｜大象互動 + 黏黏瀑布
**8:00出發**
・大象保護營 (洗澡+做大象午餐+餵食+跟象拍照)
午餐：營區附近好吃的泰式熱炒
・黏黏瀑布
晚餐：Samsen Villa (米其林)
人妖秀 (Miracle Cabaret Chiang Mai，20:00 開始表演)
・住宿：

Day 3｜水上樂園 + 夜間動物園
**8:00出發**
・清邁大峽谷水上樂園
午餐: 水上樂園區裡用餐
・藝術村 (Baan Kangwat，禮拜二沒開)
・夜間動物園
晚餐：黑森林餐廳 (禮拜三沒開)
・住宿：

Day 4｜湄林親子活動
**8:30出發**
・鳳凰冒險公園Phoenix Adventure
午餐：The Kad Farang Mae Rim
・蛇園表演
・豬豬溜滑梯
・Big C採買紀念品
晚餐: 清邁康托克帝王餐晚宴＆文化表演秀
・住宿：

Day 5｜收心慢遊・送機回國
早餐後退房
**9:30送機**
・安排送機服務 (長榮 BR258  11:50~16:30) ，結束愉快又充實的泰北親子旅程`

/**
 * GOLDEN_NORTHERN_DEEP_6D5N — 泰北芳縣深度 6 天 5 夜 golden 標準範本。
 *
 * 來源：design 2026-06-17 §4.2（docs/plans/2026-06-17-line-agent-itinerary-golden-template-design.md）。
 * 天數＝**6天5夜**（Day 1–6 完整；設計 doc §4.2 標題「7天6夜」為已更正之筆誤，見該節文末註）。
 * 內容逐字取自 Eric 手工招牌套餐設計（保留原換行、航班碼、`**` 強調等內文）。
 * 為比照 §4.1 並滿足「兩套都標 header 占位讓 LLM 套」的結構要求，於范本最前補上同款
 * 日期/人數 header（§4.2 原文未附 header block）；其餘 Day 1–6 內文逐字保留。
 *
 * 注意：同 5D4N，這是「權威範本」（保留具體航班/markdown），不是 sanitizer 路徑的 fallback 骨架，
 * 不受無航班碼 / 無 markdown drift-guard 約束。Day 1..Day 6 連續標題與「日期/人數」占位為下游 hard dependency。
 */
export const GOLDEN_NORTHERN_DEEP_6D5N = `<泰北芳縣深度6天5夜>
📅 日期：2026//～/
👨‍👩‍👧‍👦 人數：幾大幾小（幾歲，身高，需不需要兒童座椅，有無長輩，有無特殊備註事項）

Day 1｜抵達清邁 -> 湄登 -> 清道 -> 芳縣
機場接機 (長榮 BR257 7:20~10:35)
換匯所: Nakhonping Exchange
午餐: Pang Pao Beach (泰北森林美學莊園)
出發前往芳縣
・清道溶洞
・清道咖啡館
(沿途經過清道休息一下，車程比較長約3~3.5小時)
抵達芳縣 (約傍晚18:00左右抵達)
晚餐: 雲南火鍋 （一起用餐！）
住宿: 芳縣 Huen San Fang hotel (我們家的民宿)

Day 2｜芳縣 -> 金三角
**8:30出發**
・翠峰茶園 (享用特色茶餐點)
・美塞關口
・天空步道
・金三角大佛 (湄公河遊船)
・寮國一日遊
晚餐: 清萊道地熱炒
逛清萊夜市、按摩
住宿：清萊 Sann Hotel Chiang Rai

Day 3｜清萊 -> 清邁
**8:30出發**
用完早餐返回清邁 (預估傍晚15:30抵達清邁市區)
途中經過清萊溫泉（休息站）
・湄康蓬村
・瓦洛洛市場 (買伴手禮便宜)
・古城的1~2個特色廟宇 (柴狄龍寺/帕刑寺)
・按摩
晚餐: Kung Yim Shop (2nd Branch) (泰國蝦吃到飽)
住宿: 清邁古城 The Empress Premier Chiang Mai

Day 4｜茵他儂國家公園
**8:30出發**
・茵他儂國家公園主峰與雙龍塔
・Ban Mae Klang Luang 卡倫族社區生態村
午餐：苗族市場用餐
・參觀苗族市場
・The Garden Inthanon Cafe'
・瓦吉拉瀑布
晚餐: Ribs & Co Chiang Mai (豬、牛肋排)
住宿: 清邁古城 The Empress Premier Chiang Mai

Day 5｜南邦一日
**9:00 出發**
・南邦馬車遊城 5 公里（Museum Lampang 上車，先以 5 公里方案估算）
  備註：若想中途停留拍照或調整路線，可改為包車自由路線；也可依需求改選 3 公里方案。
  參考路線：白橋 / 黑橋（Ratsadaphisek Bridge；สะพานรัษฎาภิเศก；Black Bridge，兩座橋距離約 10 分鐘）
・南邦壁畫街
午餐：แสร้งว่าไทยโมเดิร์นคูซีน
・南邦鑾寺 Wat Phra That Lampang Luang
・南邦野味市場（通堅市場）Kad Tung Kwian Market
晚餐：Samsen Villa (米其林)
住宿：清邁古城 The Empress Premier Chiang Mai

Day 6｜收心慢遊・送機回國
・早餐後退房 9:30送機
送機 (長榮 BR258 11:25-15:50)，平安返家`
