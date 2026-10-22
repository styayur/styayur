# License Policy

styayur chooses licenses by each project's use and existing rights, not by
visual uniformity. This policy guides decisions; it does not override a
repository's LICENSE, contributor grant or third-party terms.

- **Applications (full apps / self-hostable services)** — strong copyleft: AGPL-3.0-only or GPL-3.0-or-later.
- **Reusable engines / frameworks / libraries** — MPL-2.0.
- **Developer infrastructure / protocol / integration runtime** — Apache-2.0.
- **Small scripts / automation** — MIT.
- **Writing / content / non-software knowledge works** — Creative Commons (e.g. CC BY 4.0).
- **Third-party materials** (fonts, datasets, models, images, dependencies) — always remain under their original licences and are never relicensed by this project.

When a repository mixes first-party source with third-party data, the
boundaries are stated explicitly (for example, application source vs. model or
dataset licences).

See each repository's LICENSE and NOTICE/THIRD_PARTY files for the
project-specific terms.

## Existing decisions and scoped projects

- Calligra and TinyTTS currently declare **GPL-3.0-or-later**, following their
  recorded license-adoption commits. Earlier policy text describing them as MIT
  was stale; this correction does not revoke permissions granted by old versions.
- Local Context Engine uses **MPL-2.0**. Its desktop metadata is aligned with the
  existing repository/workspace license, not a separate newly invented license.
- CodeForge Engine uses **Apache-2.0**. Restoring the publisher's canonical text
  and appendix corrects a nonstandard transcription, not the project's choice.
- Nickspeare code is **AGPL-3.0-or-later**; its Folger-derived data retain
  **CC BY-NC 3.0** terms. Code rights do not erase the data restriction.
- IPA-first TTS and Translation Kernel have component-specific terms. Reusable
  libraries, complete applications, scripts and prose may have different
  licenses in one repository. Read their per-directory LICENSE/SPDX records.
- Existing exceptions such as Mini Market's MPL-2.0 are preserved. The defaults
  above are not an instruction to relicense existing projects.
- Forks retain upstream copyright and licensing. A repository owner's account
  does not imply ownership of every contribution, dependency, model or asset.
- This Profile repository's prose remains CC BY 4.0. First-party automation in
  `scripts/` and marked workflow files uses the scoped MIT license copies in
  those directories. This software-specific grant does not relicense prose or
  revoke any earlier grants.

The [public decision register](docs/LICENSE_GOVERNANCE.md) links the repositories
and records preservation/correction decisions. Private reviews stay private.

## Review before changing a license

1. Compare LICENSE, README, package metadata, source headers, third-party
   notices and actual distributed assets; distinguish a stale label from an
   intended license boundary.
2. Inspect license history, releases/tags and contributor provenance. Resolve
   copyright authority and compatibility before proposing new terms.
3. If external rights, grants or compatibility remain unclear, record the
   specific issue and pause that repository's relicensing. Continue unrelated
   documentation and verification work.
4. Keep prior versions, tags, release archives, attribution and required source
   access intact. New terms do not retroactively revoke existing grants.
5. Use a separate reviewable PR with the reason, affected scope and evidence.
   Do not describe a package-metadata fix as relicensing third-party work.

Public documentation follows the [README standard](docs/README_STANDARD.md).
Future preferences do not substitute for a legally supported project decision.
