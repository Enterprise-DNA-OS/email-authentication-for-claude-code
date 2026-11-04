# Move the report-review desk from DMARC.global

Keep the operational cutover separate from changes to live email authentication.

## What is documented

DMARC.global describes [aggregate XML report analysis](https://dmarc.global/dmarc-report-analysis) and a [report ingest API on paid plans](https://dmarc.global/pricing). No public instructions for exporting its entire stored history were verified on 4 November 2026. Do not promise a native history export or treat these fixtures as vendor exports.

The supported import path is the standard receiver report you retained in your authorised reporting mailbox or archive. It accepts UTF-8 XML or gzip-compressed XML, using the common record structure in [RFC 9990](https://www.rfc-editor.org/rfc/rfc9990.html) and legacy RFC 7489 reports. If all history lives only at the vendor, request an export first and map its actual format before switching. A vendor CSV summary is not a raw aggregate report.

## One-command import

Create an empty production database, migrate it, and register the exact policy domain with its owner, collection purpose and retention-review date. Do not seed production. Then:

```sh
node scripts/auth.mjs import dmarc-global /private/archive/report.xml --dry-run --actor="Operator"
node scripts/auth.mjs import dmarc-global /private/archive/report.xml --actor="Operator"
```

Each command processes one complete report. Repeat for each retained file. The dry run validates against the current database and writes nothing. The actual import is transactional. Compare record counts, message totals and dates against the original before relying on it. Reports for unregistered domains fail, even if they are subdomains of an existing record.

## Mapping

| Input | Destination |
|---|---|
| policy_published.domain | Previously registered domain |
| report_metadata.org_name, email and report_id | Receiver identity and report key |
| date_range.begin and end | UTC interval |
| policy_published.p | Observed policy in that report, separate from the current manually recorded policy |
| row.source_ip | Domain-specific sending source |
| row.count | Observed message count |
| policy_evaluated.spf and dkim | Receiver's alignment results |
| policy_evaluated.disposition | Reported receiver handling |
| identifiers.header_from | Observed From domain |
| Full XML and each record | Original evidence, including unmodelled fields |

Imported sources start unidentified and unreviewed. The report does not authorise them. A repeated identical report does nothing. A conflicting identity or overlapping interval from the same reporter is rejected. This can reject legitimate partial or corrected reports too: reconcile them manually rather than counting both. Input is limited to 5 MiB compressed and expanded, and 20,000 observations. ZIP archives and native vendor CSV exports need preparation or a separately tested adapter.

## What requires separate work

Hosted SPF, automatic DNS publishing, the reporting mailbox, report collection, existing vendor access roles, live DNS observations, team authentication and licensed sender identification do not migrate through this file. Source names, sender approvals and investigation history are entered or mapped separately. This tool cannot reconstruct reports you did not retain.

Keep report collection and live DNS unchanged while testing. Arrange your own authorised receiver and archive before cancelling a vendor subscription that supplies either. Test collection continuity and reconcile totals first. Enterprise DNA maps available history and builds the required connections as part of the customised version. Do not cancel based on a successful demo alone.
