---
description: reports for the email authentication desk.
---

Read CLAUDE.md. Confirm the intended database and domain. Run:

```sh
node scripts/auth.mjs reports --json
```

Use the operator's actual values for placeholders. Read a record before changing it. For ambiguous matches, show the candidates and request the exact domain or identifier. Present findings and missing evidence in plain language. Never infer a successful delivery or sender authorisation from an authentication pass. Never send mail or change DNS. Draft commands return a private file to read and present in chat.
