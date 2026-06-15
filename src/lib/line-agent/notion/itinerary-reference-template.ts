/**
 * itinerary-reference-template.ts — 開閘前必修 I-1 / I-2（2026-06-15 whole-feature review）。
 *
 * 排行程 low_confidence fallback 的手工骨架，**inline 成 TS 常數**（不再 readFileSync docs/**）：
 *
 *  - I-2（runtime 可達性）：Vercel lambda 的 cwd / file tracing 不保證打包 `docs/**`，
 *    `readFileSync` 會 throw；responder 的 fail-open 雖不崩，卻會在「無命中」(語料早期最常見)
 *    時讓安全網靜默消失、LLM 從零亂編——正是範本要防的事。inline 消除檔案相依。
 *  - I-1（兩路徑共用 sanitizer）：本常數與真案例 snippet 共走同一 `sanitizeItinerarySnippet`
 *    assert（見 itinerary-reference-source.ts `templateSkeleton`），使「凡注入為骨架者皆過同一
 *    assert」成為統一不變量。常數已 curated 乾淨，sanitize 不會 fail-closed。
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
