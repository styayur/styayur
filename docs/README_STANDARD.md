# README standard

Reviewed 22-10-2026 through Calligra, Nickspeare and Local Context Engine.
[简体中文](README_STANDARD.zh-CN.md)

## Purpose

A README helps a new reader understand the project, reach first use and see its
limits. Keep `README.md` in English, provide `README.zh-CN.md`, and add
`README.ja.md` for calligraphy projects. Put language links near the beginning.
Technical translations need terminology and factual review, not unchecked
sentence substitution.

## Default reading order

| Order | Content | Guidance |
|---|---|---|
| 1 | Name and one-sentence purpose | One H1; describe a concrete use |
| 2 | Stage and meaningful visual | Evidence-based stage; prefer one real running screenshot with precise alt text |
| 3 | Features | A few actual capabilities, separated from experiments and plans |
| 4 | Installation / Quick Start | Prerequisites, directory, commands, URL/executable and first action; separate packages from source |
| 5 | Testing / CI / Platform Support | Existing commands, real workflow links/matrix and acceptance gaps |
| 6 | Known Limitations | User-visible constraints, persistence, backup, permissions and unverified claims |
| 7 | Roadmap | Brief next/future directions; no completed work presented as a plan or invented dates |
| 8 | Contributing | Real contribution, issue and security routes |
| 9 | License | Current LICENSE and separate code, data, font, image and dependency scopes |

The screenshot need not have a separate heading. Small scripts may combine
Features with the introduction and shorten Testing/Contributing/Roadmap. A
reference repository can replace installation with reading/reuse instructions.
Omit an inapplicable roadmap rather than inventing filler. Usage, necessary
limitations and licensing must remain clear. The one-sentence Profile README
is a deliberate exception, not a product README template.

## Evidence and scope

- Verify release versions, asset names and draft/prerelease status. Source
  versions and published artifacts can differ; a matching version number does
  not mean later source changes are in older binaries.
- Derive commands from current scripts, manifests and workflows. State the
  shell, working directory and prerequisites; do not rely on the author's PATH.
- Tests, builds, packages, rendering, fresh installation and physical-device
  acceptance are different evidence. Declared minimum tools and tested tools
  must be distinguished.
- Do not infer overall Stable maturity from pin order, version numbers or one
  green workflow. Implemented feature coverage is narrower than a product-level
  maturity assessment.
- Keep performance details in a linked methodology/results document unless
  they help first use. Numbers need environment, input, sampling and limits.
- Explain collection scope, saved data, refresh loss, exports/replay and network
  boundaries where they affect a user's decision.
- Record license/notice conflicts and hand them to license governance. README
  formatting is not permission to change terms or historical grants.

## Visuals and badges

Use verified running screenshots with accurate captions. Diagrams must explain
real structure; GIFs must show meaningful real interaction. Do not fabricate
interfaces, decorate with generic SVGs or treat a logo as proof of acceptance.

About seven badges is a reference ceiling, not a target. The pilot uses one
actual main-workflow badge per README. Text and source links can explain
versions, licenses and support. A badge is not a substitute for reading the
current PR checks.

## Adapting the pilot

| Project kind | First-use focus | Detail to link elsewhere |
|---|---|---|
| Graphical application | Packages, offline start, first result, save/export, platform acceptance | Coverage, asset provenance and architecture |
| Research/cultural tool | Browser/Python paths, source evidence, reproducibility limits, source/release split | Corpus rebuild, R analysis and project map |
| System/MCP tool | OS/tools, executable/query, collection scope, client configuration and forwarding boundary | Provider/planner architecture and benchmark methodology |

## Review and merge

Use a separate branch and PR for each repository. Check default-branch facts,
manifests, workflows, releases and license scope before editing. Review language
parity; executable examples should match across translations. Run existing
Markdown checks, exact-case local links/anchors/images and external-link checks,
recording temporary reachability separately from confirmed missing resources.

Execute appropriate examples and existing CI, and preserve unverified platform
acceptance as unverified. Inspect GitHub Flavored Markdown at desktop and narrow
widths; tables/code should scroll locally without body overflow. Preview
screenshots are not application smoke-test screenshots.

Have a fresh reader answer purpose, installation, current version, test scope,
license and data-boundary questions; fix concrete ambiguity and recheck
translations. Merge only when final required checks and scope pass, then read
back main and retain PR/commit evidence. Do not change source, tests, baselines
or protections merely to make a documentation-only change green.
