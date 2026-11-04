# A report desk without a front end

The useful work is recurring: read report coverage, identify unknown sources, review failures, assign investigations and prepare a weekly domain review. The CLI queries the same records each time. Claude Code, Codex, OpenCode or Cursor turns an operator's question into that command.

Read-only branded HTML shows the week, source reviews and investigations. Documents show each domain and each investigation. They contain no action buttons and do not send anything.

A screen offers mobile navigation, shared live editing, visual sorting and a sign-in boundary. This base has none of those, nor a background report collector. The embedded database needs one process at a time. PostgreSQL supports concurrent connections, but the tool still assumes trusted operators, with no application access roles. Use separate databases per customer. Enterprise DNA can build the front end and connections your team needs.

Reports are private files. Generated documents can be printed to PDF, but review the intended recipients before sharing. Poppins is loaded from Google Fonts when online, with a system-font fallback offline. Business colours and logo are configured in brand.json. The database and CLI do not need network access after package installation.
