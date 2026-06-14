/**
 * 擬真 itinerarySnippet 樣本（非真客資料）— 釘 sanitizer 行為。
 * 每筆刻意塞一種 PII 形態，驗證 scrub / fail-closed。
 */

/** 完整髒樣本：標題姓名 + 人數/日期 header + 內文航班/金額/電話/URL。 */
export const DIRTY_SNIPPET_FULL = `<李先生一家套餐訂製> 清邁親子5天4夜
👨‍👩‍👧‍👦 人數：2大2小（4歲、6歲）
📅 日期：2025/08/04～2025/08/08
Day 1｜抵達清邁
・搭華航 CI851 13:20 抵清邁，司機接機
・午餐：本地小館
・晚餐：千人火鍋
・住宿：古城區飯店
Day 2｜大象與夜間動物園
・上午大象保護營（半日）
・晚間夜間動物園，遊園車
・訂金 NT$5000，尾款 8 萬泰銖現場付
・有問題打 0912-345-678 或看 https://notion.so/abc123`

/** 乾淨骨架（已無 PII，sanitize 後應與輸入等價，僅去掉空 header）。 */
export const CLEAN_SKELETON = `Day 1｜抵達清邁
・司機接機
・午餐：本地小館
・住宿：古城區飯店`

/** fail-closed 樣本：scrub 漏網的殘留姓氏敬稱（內文「王太太」），assert 應 trip → drop。 */
export const RESIDUAL_HONORIFIC_SNIPPET = `Day 1｜抵達
・送王太太回飯店休息
・午餐：本地小館`

/** fail-closed 樣本：內文殘留 email。 */
export const RESIDUAL_EMAIL_SNIPPET = `Day 1｜抵達
・聯絡 minguide@gmail.com 安排接機`
