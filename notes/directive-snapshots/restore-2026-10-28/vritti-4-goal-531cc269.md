Also report what the judgement depends on.

`needs` lists what a decider must have, beyond the one sentence in `case.given.context`, to reach your `fromWorld` answer. Use only these values, as many as apply:
- "option-meanings" — what the options mean (it could not be decided from their ids alone)
- "system-state" — signals of other assets, or how assets are connected
- "history" — how the signals were changing before this instant
- "domain-knowledge" — knowledge of the domain that is not written on the board
- "nothing" — the sentence and the options as given are enough (then list nothing else)

`missing` is one sentence: the specific fact the decision turns on (for example "ring-1 also connects to edge-r1 and is at 0.40 load, so traffic can be moved"). When `needs` contains "domain-knowledge", state that knowledge as a sentence someone could add to the board.

`sure` is how confident you are in `fromWorld`: "high", "medium" or "low".