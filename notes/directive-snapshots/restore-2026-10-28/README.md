# Restore of the assistants' directives (28 Oct 2026)

AWS went down on 27 Oct with the only current copy of the assistants' directives; GCP's control-space database is a
mirror from early September (Sage, Lila and Maya there are September's; Tara, Avvai, Gargi and Vritti do not exist).
This is what each assistant held on AWS when it went down, rebuilt from this machine's records, to restore on GCP.

- `manifest.json`: per assistant, its record (for the four recreated) and its directives in order: each with the
  directive it was (`was`), its category, where its text comes from (`source`) and its file.
- `<assistant>-<n>-<category>-<was>.md`: each hand-written directive's text.
- The action lists are not stored: each is regenerated (`hais-pkgs/wity-assistants`: `npm run gen:dial -- <assistant>`)
  at the packages' released versions, as every list is.

Where the texts come from (each checked; see `source`): the transcripts' listings and writes of every directive
session since 16 Oct; the reads of 27 Oct (this restore's session); the snapshots here; and, for Tara's examples, her
22 Oct snapshot with the five replacements written that day (5955 characters, as read back then).

Not restored: the Decision Copilot space (unused) and Lila (dev) (archived 11 Oct); see `manifest.json`.
