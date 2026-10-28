Decide which option was the right one for this situation, and what information that judgement depends on.

Give two answers:
- `fromBoard` — using only what is in `board` and `case` (the map, the signals, the option meanings, the board's text). Do not use anything you know about the domain that is not written there.
- `fromWorld` — the same, but you may also use your own knowledge of the domain.

Each answer is an option id exactly as written in `case.given.options`, or "NONE" when no option fits the situation, or "UNDETERMINED" when the information does not settle it.

Rules for judging:
- An option is right only if the situation supports it. An option that names a remedy for something there is no sign of (for example isolating a fault when nothing indicates a fault) is not right just because it sounds related.
- If two options are both fully right, give the better one as the answer and the other in `alsoRight`.
- If you would have to guess, answer "UNDETERMINED".