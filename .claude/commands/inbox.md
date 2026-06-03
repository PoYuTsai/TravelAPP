# LINE OA Inbox

Run the project operator inbox command and return only the Traditional Chinese summary output.

Use:

```bash
npm run agent:command -- inbox
```

Rules:

- Do not print `.env.local` or any secret.
- Do not call LINE outbound APIs.
- Do not auto-reply to customers.
- If the command fails, show the error briefly and mention the exact command that failed.
