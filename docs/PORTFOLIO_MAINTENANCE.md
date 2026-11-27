# Public portfolio maintenance

The weekly public audit reads GitHub's paginated public repository inventory and
the reviewed `portfolio/audit-policy.json` in this repository. Project data comes
from GitHub and each project's own README, manifests, license and release URLs.
The writing website is not a project registry and supplies no audit data.

The audit checks public identities, descriptions, topics, reviewed license text,
command fingerprints and package scripts, required files, referenced screenshots,
active workflow badges, installer assets and public links. Missing reviewed
repositories require private investigation without serializing their identities.
Incomplete inventory and temporary failures remain uncertain; neither becomes PASS.
Directory coverage and curated website release/date comparisons were retired with
the obsolete directory. Repository-local release/install evidence remains checked.

`.github/workflows/portfolio-audit.yml` runs weekly on Monday at 02:17 UTC and
supports manual dispatch. PRs run only offline fixtures and the maturity validator:

```sh
node scripts/validate-portfolio.mjs
node --test scripts/portfolio-audit.test.mjs
```

A read-only local audit can reuse existing GitHub CLI authentication:

```sh
node scripts/portfolio-audit.mjs --gh
```

The separate notification job needs two successful independent observations,
at least six hours apart and no older than 21 days, before creating a finding.
It keeps one marked tracking issue, deduplicates unchanged findings and preserves
uncertainty. PR verification never sends notifications. No real credentials,
private repository contents, paid-provider calls or remote execution belong here.
Checks of hardware, native builds and private dependencies require their own
authorized environments; the default workflow token cannot verify those scopes.
