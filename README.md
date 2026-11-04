# Email Authentication for Claude Code

Own the email authentication desk: domain history, receiver reports, sender reviews and investigation records in one database.

## Three ways to own it

- **Do it yourself:** install this MIT-licensed base with Claude Code, Codex, OpenCode or Cursor. Your hosting and agent subscription are separate costs.
- **We customise it:** Enterprise DNA maps your available DMARC.global history, sets your review rules and fields, and builds the connections, web front end or different stack you need. One setup fee, then a retainer for ongoing work.
- **We run it for you:** Omni by Enterprise DNA installs and maintains your version, with access, backups and recurring reviews arranged. One setup fee, then a retainer.

[Book a 30-minute call with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=dmarc-global).

## Run the synthetic demo

Node 20 or newer. No cloud database is needed.

```sh
npm install
npm test
npm run demo
npm run auth -- unknown-senders
npm run auth -- summary --json
npm run view
npm run docs
```

The demo includes an unknown source failing both aligned checks, a quiet approved service, missing reports, expired reviews and overdue investigation work. Repeated seeding preserves existing records. Use a fresh DATA_DIR for production, migrate it, and never seed it. Set DATABASE_URL for PostgreSQL. Embedded PGlite supports one process at a time.

## What it does

Seven domain record types and four database views support the weekly review. Standard aggregate XML reports map receiver observations to registered domains and source IPs. SPF and DKIM are the receiver's aligned results. A failure requires both to fail. Sender approval is a separate operator decision. Receiver disposition, metadata, original XML and unmodelled record fields remain available.

Imports are transactional. Duplicate identical reports are harmless. Changed content with the same identity and overlapping intervals from the same receiver are rejected for reconciliation. Only registered policy domains are accepted. There is a 5 MiB compressed and expanded input limit and a 20,000-record limit. XML and gzip are supported.

This is the internal review workflow, not a full replacement for DMARC.global's hosted services. It has no email receiver, automatic mailbox download, DNS publishing, hosted SPF, sign-in service, sender intelligence feed or real-time alerts. Collection and DNS hosting must be arranged separately before switching. A pass never guarantees inbox delivery.

## Recurring jobs

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
| /customise | Add a field, rename a label or change a rule with a tested migration. |
| /new-view | Add a read-only branded report. |

27 CLI commands and 29 slash-command recipes. All CLI commands support --json.

## Ten questions your records answer

1. Which domains have received no reports or only old reports? (`coverage`)
2. Which unknown sources account for authentication failures? (`unknown-senders`)
3. Which approved sending sources still fail both aligned checks? (`failures`)
4. Which approved services have been quiet for over a month? (`quiet-senders`)
5. Which investigations are overdue and who owns them? (`overdue`)
6. Which domains lack a recorded collection purpose? (`compliance`)
7. Which domain retention reviews are due? (`compliance`)
8. Which sender reviews have expired? (`compliance`)
9. Which domains combine failed messages, unreviewed sources and open cases? (`summary`)
10. What did a receiver actually report before we opened a case? (`report demo-harbour`)

These are implemented queries, not a claim about what a vendor can never answer. Change the rules and joins when your business needs a different answer.

## Your first hour: ten things to ask for

1. Put our business name, colours and logo in brand.json.
2. Show domains whose reports have gone quiet.
3. Show unidentified sources that fail authentication.
4. List approved services with recent failures.
5. Show the overdue investigation queue.
6. Draft our weekly review.
7. Test one retained report and reconcile its counts.
8. Record a sender review with evidence and its next review date.
9. Add our service-owner field with a tested migration.
10. Export a private snapshot before changing a rule.

## Switch and operate

[The replace guide](docs/replace-dmarc-global.md) describes a one-command import per retained receiver XML report. Native DMARC.global history export was not verified. Do not assume the vendor can supply all historical XML. A CSV export requires its own tested mapping. The fixture is synthetic, not a vendor-provided sample.

Edit brand.json, then render the week, sender review and investigation dashboards with npm run view. npm run docs produces domain review packs and investigation records. Draft commands prepare the weekly review, one domain review and a policy-change review with its evidence snapshot. Nothing sends, changes DNS or approves a change. Read [why no front end](docs/why-no-front-end.md).

[Compliance](docs/compliance.md) cites current IETF rules and NZ privacy principles. Review dates and stale-report thresholds are local policies. Privacy and host controls need configuration for your business. [Research](docs/research.md) records pricing, scores and the limits of buyer evidence.

## Validation and storage

npm test creates a temporary database, exercises all commands, checks malformed and hostile XML, duplicate and overlapping reports, transaction rollback, aligned authentication logic, escaped HTML and snapshot completeness. CI runs Windows and Ubuntu with Node 20 and 22, plus PostgreSQL 16. A configured workflow is not evidence that it passed; inspect its run.

Tables enable row-level security and remove PUBLIC privileges. This is a trusted-operator tool with no multi-tenant access layer. Use one database per customer. Actor names are labels, not authenticated identities. The database owner can bypass controls. Back up the database and protect generated files and exports. JSON snapshots contain the entire domain history and raw reports but automatic snapshot restore is not supplied. Native database backups remain necessary.

## Licence

MIT. Copyright 2026 Enterprise DNA. DMARC.global belongs to its owner. No vendor code, assets or licensed intelligence are included.
