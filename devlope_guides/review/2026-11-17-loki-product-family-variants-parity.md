# Loki Product Family Variants Phase 1 Parity Record

## Result

**PASS** — the complete seed store and complete normalized store produced by the
Phase 1 candidate are byte-for-byte identical to the Phase 1 baseline after
canonicalization.

This record is separate from the ordinary test results. The parity run directly
compared both `createSeedDepositPresets` output and `loadDepositPresets` output
from isolated worktrees.

## Comparison identity

```text
BASE_REF=1ddc22b529765da1e388ea80fcf3b885ce0fa835
HEAD_REF=2591fcc7a9b829c3577a75a9d4db71532aafa398
BASE_WORKTREE=/private/tmp/loki-parity-base.7lPG6H
HEAD_WORKTREE=/private/tmp/loki-parity-head.NNuml7
ENV_SOURCE=both worktrees/.env.test
ENV_SHA256=db5582a379937cf1e1579518b007939cd0b1fde78d643dadaa5bbf8936c6415d
MAKE_ID=(prefix: string) => `${prefix}fixed-id`
DATA_SOURCE=both worktrees/data/deposit
DATA_SHA256=be55ab50b7837e6a592e77db8518afcc60e24cc47c9f159a9e06e5b0920569f7
PARITY_HARNESS=scripts/deposit-presets-parity.ts
```

`BASE_REF` is the last commit before the Phase 1 runtime refactor. `HEAD_REF`
is the isolated temporary candidate commit containing the preset refactor, its
tests, and the parity harness. The verification worktrees and output directories
were temporary and are not used as an environment or data source after this
run; their identities and output checksums are retained here.

## Canonicalization

- Recursively sort every object key using ascending key order.
- Preserve array order.
- Serialize with `JSON.stringify(value, null, 2)` followed by one LF newline.
- Hash the exact UTF-8 serialized bytes with SHA-256.

## Output artifacts and comparison

Each worktree produced the same two artifact names through the same harness:

| Store | Baseline artifact | Candidate artifact | Bytes | Baseline SHA-256 | Candidate SHA-256 | Byte diff |
| --- | --- | --- | ---: | --- | --- | --- |
| Seed `createSeedDepositPresets` | `/private/tmp/loki-parity-base-output.VlZ7ih/seed-store.json` | `/private/tmp/loki-parity-head-output.ENy1xR/seed-store.json` | 100828 | `24bf3f98fdfdb756178d8f8e2a99eff50c50d629142e3b8bbc5151e457a8b31f` | `24bf3f98fdfdb756178d8f8e2a99eff50c50d629142e3b8bbc5151e457a8b31f` | `cmp`: zero diff |
| Normalized `loadDepositPresets` | `/private/tmp/loki-parity-base-output.VlZ7ih/normalized-store.json` | `/private/tmp/loki-parity-head-output.ENy1xR/normalized-store.json` | 100128 | `d0b668e4f65464158d9f5ad82d6e90ae42bf1f390e5f213ec69d3cc72681f0ed` | `d0b668e4f65464158d9f5ad82d6e90ae42bf1f390e5f213ec69d3cc72681f0ed` | `cmp`: zero diff |

The four output artifact names, both complete store types, exact checksums, and
the direct byte comparisons are recorded above. No `.env.test` values were
written into this record.

## Reproduction

Run the same harness once for each isolated worktree, with the same `.env.test`
and `data/deposit` source copied into both worktrees:

```text
bun run scripts/deposit-presets-parity.ts \
  --worktree <BASE_WORKTREE> \
  --output-dir <BASE_OUTPUT_DIR>

bun run scripts/deposit-presets-parity.ts \
  --worktree <HEAD_WORKTREE> \
  --output-dir <HEAD_OUTPUT_DIR>
```

Compare corresponding `seed-store.json` and `normalized-store.json` files with
`cmp` and compare their SHA-256 checksums. Both comparisons must remain zero
diff with identical checksums for the parity gate to pass.
