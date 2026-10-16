# Directive snapshots — for rollback only, never canonical

An assistant's instructions are its directives (control vectors) in its control space on the server; they have no
version history. Before a directive is changed, what it said is kept here, in a file named
`<assistant>-<UTC date-time>.md` — so it can be put back.

**Not canonical.** What an assistant is told now is read from the server: wity-mcp `directive_list { space }` (or
`assistant_get` for the space). A snapshot is what was there at its timestamp, nothing more.

Generated directives (the action lists: `renderActionsVector` in @wity-ai/authoring and @wity-ai/scene-authoring,
with @wity-ai/dial-runtime's `renderProtocol`) are not snapshotted: they are regenerated from the package version.
