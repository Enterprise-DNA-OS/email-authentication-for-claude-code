# Email Authentication for Claude Code

For an owner or IT operator reviewing their authorised domains and retained receiver reports. Confirm the business and database before using real records. Demo records are synthetic.

## Operating rules

Start every answer from the CLI. Read before changing a record. Dates and report intervals use UTC. Never send mail, publish DNS, alter hosted SPF, fetch mailboxes or process another customer's data. Policy reviews are drafts, never change approvals. Do not invent sender identities or treat an authentication pass as delivery proof. Use separate databases per customer.

## Recurring jobs

Every command supports --json. Flags use --name=value. Names match case-insensitively and unique id prefixes work. Ambiguous matches list candidates and exit 1.

| Command | Usage |
|---|---|
| /domains | `domains` |
| /reports | `reports` |
| /sources | `sources` |
| /failures | `failures` |
| /unknown-senders | `unknown-senders` |
| /quiet-senders | `quiet-senders` |
| /coverage | `coverage` |
| /policy-review | `policy-review` |
| /investigations | `investigations` |
| /overdue | `overdue` |
| /compliance | `compliance` |
| /activity | `activity` |
| /summary | `summary` |
| /domain | `domain <name-or-id-prefix>` |
| /report | `report <id-prefix-or-report-key>` |
| /add-domain | `add-domain <domain> --owner=NAME --purpose=TEXT --review-by=YYYY-MM-DD --actor=NAME` |
| /review-domain | `review-domain <domain> --owner=NAME --purpose=TEXT --review-by=YYYY-MM-DD --actor=NAME` |
| /review-sender | `review-sender <domain> <ip> --service=NAME --decision=approved|blocked|unknown --evidence=TEXT --review-by=YYYY-MM-DD --actor=NAME` |
| /record-policy | `record-policy <domain> --policy=none|quarantine|reject --observed-at=ISO --evidence=TEXT --actor=NAME` |
| /log-investigation | `log-investigation <domain> --code=CODE --title=TEXT --owner=NAME --due=YYYY-MM-DD --evidence=TEXT --actor=NAME` |
| /close-investigation | `close-investigation <code-or-id-prefix> --outcome=TEXT --actor=NAME` |
| /import | `import dmarc-global <saved.xml|saved.xml.gz> --actor=NAME [--dry-run]` |
| /export | `export --out=NEW-FILE.json` |
| /draft-domain | `draft-domain <domain> --actor=NAME` |
| /draft-policy | `draft-policy <domain> --policy=none|quarantine|reject --rationale=TEXT --actor=NAME` |
| /weekly-review | `weekly-review --actor=NAME` |
| /help | `help` |
| /customise | Add a field or rule through a tested migration. |
| /new-view | Add a branded read-only report. |

## Files and checks

scripts/auth.mjs is the only domain CLI. DATABASE_URL selects PostgreSQL. Otherwise DATA_DIR selects local PGlite under .data/db. Apply migrations with npm run migrate. Never seed a production database. Read docs/replace-dmarc-global.md before import and docs/compliance.md before interpreting the checks.

Use npm test after changes. Add migrations for existing installations. Run npm run view and npm run docs for branded HTML. brand.json controls the business name, colours and logo. Generated files, backups and raw reports are private. Actor names are operator labels, not verified identities.

Built and run through Omni by Enterprise DNA. https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=dmarc-global
