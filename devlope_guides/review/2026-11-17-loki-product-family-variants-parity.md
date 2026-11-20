# Loki Product Family Variants Phase 1 Parity Record

## Result

**PASS**: the complete seed store and complete normalized store produced by the
Phase 1 candidate are byte-for-byte identical to the Phase 1 baseline after
canonicalization.

This record is separate from the ordinary test results. The parity run directly
compared both `createSeedDepositPresets` output and `loadDepositPresets` output
from isolated worktrees.

## Comparison identity

```text
BASE_REF=1ddc22b529765da1e388ea80fcf3b885ce0fa835
HEAD_REF=48cc6f25cf9ede407184a82c6f0f75a9ea4ccde0
BASE_WORKTREE=/private/tmp/loki-parity-base.MakyIB
HEAD_WORKTREE=/private/tmp/loki-parity-head.xB6W7J
ENV_SOURCE=both worktrees/.env.test
ENV_SHA256=db5582a379937cf1e1579518b007939cd0b1fde78d643dadaa5bbf8936c6415d
MAKE_ID=(prefix: string) => `${prefix}fixed-id`
DATA_SOURCE=both worktrees/data/deposit
DATA_SHA256=be55ab50b7837e6a592e77db8518afcc60e24cc47c9f159a9e06e5b0920569f7
PARITY_HARNESS=scripts/deposit-presets-parity.ts
```

`BASE_REF` is the last commit before the Phase 1 runtime refactor. `HEAD_REF`
is the Phase 1 candidate commit containing the preset refactor, its tests, and
the parity harness. It is not the current branch HEAD. The verification source
trees and output directories were temporary and are not used as an environment
or data source after this run; their identities and output checksums are
retained here.

## Canonicalization

- Recursively sort every object key using ascending key order.
- Preserve array order.
- Serialize with `JSON.stringify(value, null, 2)` followed by one LF newline.
- Hash the exact UTF-8 serialized bytes with SHA-256.

## Output artifacts and comparison

The recorded comparison contains the same two compared store artifact names
for each worktree. The current compare mode additionally writes a metadata
artifact that records the worktree HEAD, clean-state result, input checksums,
fixed `makeId` identity, and output checksums.

| Store | Baseline artifact | Candidate artifact | Bytes | Baseline SHA-256 | Candidate SHA-256 | Byte diff |
| --- | --- | --- | ---: | --- | --- | --- |
| Seed `createSeedDepositPresets` | `/private/tmp/loki-parity-base-output.rlVlJj/seed-store.json` | `/private/tmp/loki-parity-head-output.m5KSqu/seed-store.json` | 100828 | `24bf3f98fdfdb756178d8f8e2a99eff50c50d629142e3b8bbc5151e457a8b31f` | `24bf3f98fdfdb756178d8f8e2a99eff50c50d629142e3b8bbc5151e457a8b31f` | `cmp`: zero diff |
| Normalized `loadDepositPresets` | `/private/tmp/loki-parity-base-output.rlVlJj/normalized-store.json` | `/private/tmp/loki-parity-head-output.m5KSqu/normalized-store.json` | 100128 | `d0b668e4f65464158d9f5ad82d6e90ae42bf1f390e5f213ec69d3cc72681f0ed` | `d0b668e4f65464158d9f5ad82d6e90ae42bf1f390e5f213ec69d3cc72681f0ed` | `cmp`: zero diff |

The four store artifact paths, both complete store types, exact checksums, and
the direct byte comparisons are recorded above. No `.env.test` values were
written into this record.

## Reproduction

Run the compare mode once for both isolated worktrees. Before candidate loading,
create approval manifests outside both worktrees from a trusted caller:

```text
bun run scripts/deposit-presets-parity.ts \
  --create-approval \
  --worktree <BASE_WORKTREE> \
  --expected-ref <BASE_REF> \
  --approval-file <BASE_APPROVAL_FILE>

bun run scripts/deposit-presets-parity.ts \
  --create-approval \
  --worktree <HEAD_WORKTREE> \
  --expected-ref <HEAD_REF> \
  --approval-file <HEAD_APPROVAL_FILE>
```

The compare command requires the expected ref and matching approval file for
each worktree, rejects dirty worktrees, verifies that both inputs have identical
checksums, and compares both output artifacts. Each output directory must be a
new, non-existing path outside both worktrees. The harness rejects an existing
output directory to preserve previously published parity evidence.

```text
bun run scripts/deposit-presets-parity.ts \
  --base-worktree <BASE_WORKTREE> \
  --base-ref <BASE_REF> \
  --base-approval-file <BASE_APPROVAL_FILE> \
  --head-worktree <HEAD_WORKTREE> \
  --head-ref <HEAD_REF> \
  --head-approval-file <HEAD_APPROVAL_FILE> \
  --base-output-dir <BASE_OUTPUT_DIR> \
  --head-output-dir <HEAD_OUTPUT_DIR>
```

The command writes `seed-store.json`, `normalized-store.json`, and
`parity-metadata.json` for each worktree. It exits successfully only when both
corresponding store artifacts are byte-for-byte identical and all recorded
worktree and input identities match.
