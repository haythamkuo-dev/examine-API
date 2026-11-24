# Historical parity evidence

Phase 1 candidate `48cc6f25cf9ede407184a82c6f0f75a9ea4ccde0` was compared with
baseline `1ddc22b529765da1e388ea80fcf3b885ce0fa835` using the same `.env.test`,
`data/deposit` source, and fixed `makeId`. The canonicalized complete outputs of
`createSeedDepositPresets` and `loadDepositPresets` both produced zero byte diff.

This is one-time historical evidence for that baseline-to-candidate comparison.
It does not validate the current branch HEAD, define a Phase 1 completion gate,
or require a repository parity harness, approval manifest, isolated worktree,
checksum artifact, or reproduction command.
