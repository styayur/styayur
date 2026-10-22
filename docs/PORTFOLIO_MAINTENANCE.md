# Portfolio maintenance

The [Portfolio Governance Project](https://github.com/users/styayur/projects/1)
groups work by repository or workflow. It uses Inbox, Audit, Ready, In progress,
Review, Done and Deferred; Priority P0–P3; and ten Surface choices covering profile,
README, metadata, visuals, licenses, website, private hygiene, the board,
automation and social recommendations. Target, Evidence, PR / Issue and Owner
carry the concrete destination and proof. There is no due-date field.

Use linked pull requests/issues as work items. Done means merged and read back,
or otherwise directly verified. Review does not mean deployed. Deferred records
the missing evidence or decision; do not create an issue for every formatting edit.
Private details belong only in authorized private evidence and private work items.

## Weekly public audit

`portfolio-audit.yml` runs Monday at 02:17 UTC (10:17 Singapore) and on manual
dispatch. Pull requests run offline fixture tests and the existing maturity-data
validator; they cannot open issues or make network audit requests.

The read job enumerates **public owner repositories**, with pagination, then checks:

- README, descriptions, topics and reviewed Chinese/contribution documents;
- reviewed LICENSE hashes, GitHub license metadata and scoped package declarations;
- CI badges against active workflow paths;
- local Markdown targets, public links, installer release tags/assets and previews;
- npm run commands against their documented package path, plus changed command
  blocks that require a source/installation review;
- real screenshot presence or the explicit text-only rationale;
- the website's public registry, release labels, public coverage and recent source dates.

The site registry is a controlled build input at
[`styayur.co.uk/portfolio.json`](https://styayur.co.uk/portfolio.json). Review source
diffs and formal releases before updating it; metadata edits, bots and documentation
commits must not advance the project ordering date. The audit checks the ten most
recent commits per project, excluding reviewed governance commits, merges, bots and
documentation-only paths. Deeper source history and semantic behavior need manual
review. A changed command fingerprint is a review request, not proof of a broken
command. The job never installs or runs software from linked repositories.

`portfolio/audit-policy.json` records the reviewed component terms, required paths,
command-block fingerprints and visual policy. Update it in a PR after checking the
actual change; never suppress a license change without reviewing rights and scope.
The optional `npmDirectory` records an explicitly reviewed prose instruction such
as “from apps/web”; an explicit `cd` inside a code block takes precedence.

HTTP 404/410 is retried before becoming a finding. Timeouts, rate limits, other 4xx
and server errors remain **uncertain**, with no automatic document rewrite. Artifact
`portfolio-audit` records public evidence and counts, retained for 30 days. Failure
to enumerate the complete public inventory fails the read job and blocks notification.

A separate notification job uses the previous successful scheduled/manual artifact.
Findings need two successful audits **at least six hours apart**, no more than 21 days
apart. It creates or updates one marker-owned tracking issue in this Profile hub,
leaves unchanged findings quiet, and closes it after two independent clean runs with
no uncertainty. Missing/expired previous artifacts cannot confirm new alerts. Workflow
concurrency serializes runs to prevent duplicate issue creation.

## Permissions and operation

The audit job has `contents: read` and `actions: read` (previous artifact retrieval).
Only the main-branch notification job has `issues: write`, restricted in code to this
hub's issue endpoint. Checkout does not persist credentials. The existing scoped
Actions token is sent only to api.github.com, without authenticated redirects; public
link requests carry no token. No PAT, browser token or additional secret is needed.
Default Actions tokens do not provide access to unrelated private repositories;
their structure checks stay in a separately authorized private environment.

Run offline checks locally:

```powershell
node scripts/validate-portfolio.mjs
node --test scripts/portfolio-audit.test.mjs
```

Run a public read-only audit locally with public API access, or dispatch it on GitHub:

```powershell
node scripts/portfolio-audit.mjs --gh
gh workflow run portfolio-audit.yml --repo styayur/styayur --ref main
```

Review the artifact before acting on a finding. Keep one low-frequency review after
substantive releases, and revisit maturity only with installation, recovery and user
evidence. Preserve historical tags, releases, source notices and existing URLs.
