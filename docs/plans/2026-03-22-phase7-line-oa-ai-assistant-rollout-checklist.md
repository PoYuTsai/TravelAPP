# 2026-03-22 Phase 7 LINE OA AI Assistant Rollout Checklist

## Goal

Use this checklist before enabling the LINE OA assistant in production. The Phase 7 code path is intentionally staged, so rollout should happen behind configuration and operator verification.

## Environment

- [ ] `LINE_CHANNEL_ACCESS_TOKEN` is set in the deployment environment.
- [ ] `LINE_CHANNEL_SECRET` is set in the deployment environment.
- [ ] `TELEGRAM_BOT_TOKEN` is set in the deployment environment.
- [ ] `TELEGRAM_GROUP_ID` is set in the deployment environment.
- [ ] `TELEGRAM_WEBHOOK_SECRET` is set and matches Telegram webhook configuration.
- [ ] `LINE_ASSISTANT_CRON_SECRET` is set for protected cron routes.
- [ ] `NOTION_TOKEN` and `NOTION_CUSTOMER_DATABASE_IDS_JSON` are set before enabling returning-customer hints.
- [ ] `ANTHROPIC_API_KEY` is set before enabling model-backed draft generation in production.

## External Setup

- [ ] LINE Messaging API webhook URL points to `/api/line-webhook`.
- [ ] A periodic cron or equivalent deployment job hits `/api/line-webhook/process`.
- [ ] Telegram bot webhook points to `/api/telegram-callback`.
- [ ] Telegram webhook includes the same secret token configured in `TELEGRAM_WEBHOOK_SECRET`.
- [ ] Telegram group is a topics-enabled supergroup.
- [ ] Telegram bot is in the target group and has permission to create / manage topics and post messages.
- [ ] LINE OA push quota and fallback process have been reviewed before enabling real sends.

## Verification

- [ ] `npm run lint`
- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] Send one test LINE message and confirm a Telegram topic summary appears exactly once.
- [ ] Confirm the first test LINE message creates a real Telegram forum topic and later messages from the same LINE user reuse that topic.
- [ ] Confirm each new pending draft appears in Telegram with compact inline action buttons and callback token resolution works.
- [ ] Send one real Telegram photo and confirm recipient-selection buttons appear exactly once.
- [ ] Select one recipient from Telegram and confirm LINE receives the image through `/api/line-media/[token]`.
- [ ] If `ANTHROPIC_API_KEY` is enabled, confirm a test inbound message creates an Anthropic-backed draft instead of the local fallback template.
- [ ] Trigger the same Telegram callback twice and confirm LINE send happens only once.
- [ ] Confirm the Telegram inline button stops spinning after callback acknowledgement is returned.
- [ ] Verify a failed LINE send is logged and does not silently disappear.
- [ ] Run the housekeeping cron route with a valid secret in staging.
- [ ] Review one generated weekly report and confirm recommendations are understandable.

## Operational Readiness

- [ ] Eric confirms the reply tone matches the Chiangway Travel brand voice.
- [ ] PII retention and deletion rules are documented for operators.
- [ ] Audit log access is limited to internal operators only.
- [ ] A manual fallback path exists if LINE push or Telegram callback fails during rollout.
- [ ] Claude handoff and README status are updated after the rollout branch merges.
