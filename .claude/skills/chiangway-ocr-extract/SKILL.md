---
name: chiangway-ocr-extract
description: OCR an image or file sent to LINE/DC, extract structured Chiangway booking fields with confidence scores, fill KV draft and optionally Notion when allowed.
---

## Trigger

Fire when:
- A LINE webhook event carries an image or file message in the partner group and the message was quoted or the bot is tagged with: `@清微AI助理 幫我讀這張圖，整理成客人需求` or similar.
- An operator DC command includes "OCR" / "讀圖" / "extract" + a LINE messageId.
- A LINE OA customer sends an image (e.g., a booking voucher, itinerary screenshot, airline ticket) and the team asks the bot to extract it.

## Goal

1. Fetch the image or file content using the LINE message ID.
2. Run vision/OCR extraction.
3. Map extracted text to structured Chiangway booking fields.
4. Return extracted fields with confidence scores and unclear fields highlighted.
5. Fill the KV draft case record automatically if confidence ≥ 0.8.
6. Propose Notion field fill as a separate confirmation step, not automatic.

## Inputs

- `messageId`: LINE message ID for the image/file.
- `caseId` (optional): links extraction to the right case.
- `expectedFields` (optional): array of field names the team wants extracted.
- `actor`: who requested the extraction.

## Extractable Fields

Customer name, travel dates, duration, adults count, children count, child ages, child seat requirement, luggage count, pickup/dropoff locations, lodging name/location, desired attractions, desired restaurants, guide requirement, quote total, included items, excluded items, payment terms, notes.

For airline tickets: flight number, departure/arrival time, airline, terminal.
For hotel vouchers: hotel name, check-in/check-out dates, room type.

## Output Format

```text
[圖片 OCR 已整理]
#{caseId}｜{customerDisplayName or "未綁定"}

已讀取：
- {field}: {value} (信心度 {0-1})
…

不確定：
- {field}: {reason — e.g., 文字模糊, 資訊不完整, 數值有多種解讀}
…

已更新：
- KV draft：{已更新 | 未更新，原因}
- Notion：{尚未寫入，等待確認 | 已寫入 (信心度全部 ≥ 0.8) | 不適用}

建議下一步：
{1-2 action sentences}
```

If OCR fails or image cannot be fetched:
```text
[圖片 OCR 失敗]
錯誤：{error message}
messageId：{id}
建議：請確認圖片格式為 JPG/PNG/PDF，或直接貼文字版本。
```

## Escalation Rules

- If confidence < 0.5 on child ages, car count, or a field that affects price or safety → do NOT fill KV or Notion automatically; ask the team to supply the value manually.
- If the image appears to be a customer's passport, ID, or financial document → flag immediately; do NOT extract personal ID numbers or financial data; escalate to Eric.
- If the LINE message is from the official OA customer channel (not the partner group) → extract only if explicitly commanded; do NOT auto-process OA customer images.
- If the extraction result would overwrite an existing KV field with higher confidence → flag the conflict; do not silently overwrite.

## Must NOT

- NEVER auto-reply to the LINE OA customer based on image extraction.
- NEVER auto-fill Notion without a separate team confirmation step (KV auto-fill at ≥ 0.8 is allowed; Notion always requires confirmation).
- NEVER extract or store customer passport numbers, national ID numbers, credit card numbers, or other sensitive personal data.
- NEVER skip the confidence score output. Every extracted field must carry a confidence value.
- NEVER post OCR results to the LINE partner group from DC without Eric's explicit send command.
- NEVER write API keys or tokens into any repo file.
