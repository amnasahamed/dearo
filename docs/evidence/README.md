# Security evidence, 2026-10-24

These files contain ordinary public-registry audit/package metadata and dependency
relationships only. No environment dump, authentication data, signing material,
contacts or guest data is included.

- npm-audit.json: expanded independent explicit-registry full audit at 13:14:21Z (35 high).
- npm-audit-production.json: expanded independent explicit-registry omit-dev audit at 13:14:34Z (31 high).
- dependency-chain.txt: `npm ls node-forge zod @expo/cli @expo/code-signing-certificates --all`.
- node-forge-registry.json: `npm view node-forge@latest name version dist-tags repository.url --json`.
- zod-fixed-registry.json: `npm view zod@4.6.6 name version repository.url dist.integrity --json`.
- zod-latest-registry.json: `npm view zod@latest name version dist-tags --json`.
- installed-dependency-metadata.json: selected installed package names, versions,
  and declared dependency ranges, extracted from package.json files.
- capture.json: capture time, current lockfile hash and hashes of evidence files.

An audit exit code indicating vulnerabilities is expected. Both audit JSON files
must parse, contain metadata/vulnerabilities and not contain an error response.
These are point-in-time evidence, not a clean audit or automatic waiver.

## Discrepant snapshots retained

- *earlier-1313.json: original local 13:13 ordinary-registry results (5/5 high).
- *local-explicit-registry.json: local 13:14 repeated explicit-registry results
  (5/5 high).
- *fresh-cache.json: local 13:15 explicit-registry results using a new empty npm
  cache (5/5 high). Local npm version 11.9.0.

All results have the same lockfile hash and two leaf advisories. The expanded
35/31 reports additionally propagate meta-vulnerabilities through ancestor/peer
dependencies. Exact cause of divergent propagation counts is not established;
use 35/31 as conservative release status, preserve rather than discard evidence.
No credentials or environment dumps are included.
