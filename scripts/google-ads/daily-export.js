/**
 * 清微旅行 Google Ads 每日資料匯出
 *
 * 用法（一次設定）：
 * 1. Google Ads 左側「工具」→「批次動作」→「指令碼」→ 建立新指令碼
 * 2. 貼上本檔全部內容，按「授權」（用帳戶擁有者身分同意）
 * 3. 按「預覽」跑第一次 → 到「記錄」找到 Spreadsheet URL，貼回給 CC
 * 4. 設排程：每天早上 8 點執行
 *
 * 之後 CC 端讀法：把該 Sheet「檔案 → 共用 → 發布到網路」選 CSV，
 * curl 該 CSV 連結即可拿到最新資料。
 */

var SPREADSHEET_URL = ''; // 第一次跑完後，把記錄裡印出的 URL 填回這裡再存檔

function main() {
  var ss;
  if (SPREADSHEET_URL) {
    ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  } else {
    ss = SpreadsheetApp.create('Chiangway Google Ads 每日匯出');
    Logger.log('=== 新建 Spreadsheet，把這個 URL 填回 SPREADSHEET_URL 並存檔 ===');
    Logger.log(ss.getUrl());
  }

  exportCampaignDaily(ss);
  exportSearchTerms(ss);
  exportKeywords(ss);

  Logger.log('完成：' + ss.getUrl());
}

// 分頁1：各廣告活動 × 每日（近 30 天）費用/曝光/點擊/轉換
function exportCampaignDaily(ss) {
  var sheet = getSheet(ss, 'campaign_daily');
  sheet.clear();
  sheet.appendRow(['date', 'campaign', 'status', 'cost_twd', 'impressions', 'clicks', 'ctr', 'conversions', 'conv_value']);

  var rows = AdsApp.search(
    'SELECT segments.date, campaign.name, campaign.status, metrics.cost_micros, ' +
    'metrics.impressions, metrics.clicks, metrics.ctr, metrics.conversions, metrics.conversions_value ' +
    'FROM campaign WHERE segments.date DURING LAST_30_DAYS ' +
    'ORDER BY segments.date DESC'
  );
  appendRows(sheet, rows, function (r) {
    return [
      r.segments.date,
      r.campaign.name,
      r.campaign.status,
      Number(r.metrics.costMicros) / 1e6,
      r.metrics.impressions,
      r.metrics.clicks,
      r.metrics.ctr,
      r.metrics.conversions,
      r.metrics.conversionsValue,
    ];
  });
}

// 分頁2：搜尋字詞（近 30 天）——audit 廢字/加否定關鍵字的依據
function exportSearchTerms(ss) {
  var sheet = getSheet(ss, 'search_terms');
  sheet.clear();
  sheet.appendRow(['search_term', 'campaign', 'ad_group', 'impressions', 'clicks', 'cost_twd', 'conversions']);

  var rows = AdsApp.search(
    'SELECT search_term_view.search_term, campaign.name, ad_group.name, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
    'FROM search_term_view WHERE segments.date DURING LAST_30_DAYS ' +
    'ORDER BY metrics.cost_micros DESC'
  );
  appendRows(sheet, rows, function (r) {
    return [
      r.searchTermView.searchTerm,
      r.campaign.name,
      r.adGroup.name,
      r.metrics.impressions,
      r.metrics.clicks,
      Number(r.metrics.costMicros) / 1e6,
      r.metrics.conversions,
    ];
  });
}

// 分頁3：關鍵字成效（近 30 天）
function exportKeywords(ss) {
  var sheet = getSheet(ss, 'keywords');
  sheet.clear();
  sheet.appendRow(['keyword', 'match_type', 'campaign', 'ad_group', 'impressions', 'clicks', 'cost_twd', 'conversions', 'quality_score']);

  var rows = AdsApp.search(
    'SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ' +
    'campaign.name, ad_group.name, metrics.impressions, metrics.clicks, ' +
    'metrics.cost_micros, metrics.conversions, ad_group_criterion.quality_info.quality_score ' +
    'FROM keyword_view WHERE segments.date DURING LAST_30_DAYS ' +
    'ORDER BY metrics.cost_micros DESC'
  );
  appendRows(sheet, rows, function (r) {
    var qi = r.adGroupCriterion.qualityInfo;
    return [
      r.adGroupCriterion.keyword.text,
      r.adGroupCriterion.keyword.matchType,
      r.campaign.name,
      r.adGroup.name,
      r.metrics.impressions,
      r.metrics.clicks,
      Number(r.metrics.costMicros) / 1e6,
      r.metrics.conversions,
      qi ? qi.qualityScore : '',
    ];
  });
}

function getSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function appendRows(sheet, rows, mapFn) {
  var data = [];
  while (rows.hasNext()) {
    data.push(mapFn(rows.next()));
  }
  if (data.length) {
    sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  }
}
