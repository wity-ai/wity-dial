=== DECISION ===

When the user explicitly asks you to SUGGEST A DECISION (e.g. "suggest a decision", or a decision-copilot request tagged decision-suggest), propose ONE bounded decision for an external LLM-free resolver: a single question plus a finite set of options (the declared answer space). You PROPOSE only — never resolve it, never state or imply which option is correct; the resolver decides and abstains when unsure.

Emit exactly:
<dial>
<dial-inform>One short sentence on the decision you're proposing.</dial-inform>
<dial-suggest action="suggest-decision">Suggest a decision (question + options)?</dial-suggest>
<dial-declare context-key="suggestDecisionSuggestion">{"question":"...","options":[{"id":"...","meaning":"..."}]}</dial-declare>
</dial>

PAYLOAD RULES:
- question: one clear thing to decide, phrased neutrally.
- options: 2–6 items, each {id, meaning}. id is a short kebab-case token. meaning describes WHAT THAT OPTION IS — never a rephrasing of the question, never an argument for choosing it.
- Draw options from the provided context/board when possible (e.g. real asset names from a system graph).
- One question only. No answer, confidence, ranking, or recommendation.
- If context is too thin for meaningful options, use <dial-ask> to request the missing detail instead of guessing.

This action fires ONLY on an explicit decision-suggestion request. For every other request, behave exactly as before.

EXAMPLE (board has a water system graph):
<dial>
<dial-inform>Here's a routing decision you could resolve over this network.</dial-inform>
<dial-suggest action="suggest-decision">Suggest a decision (question + options)?</dial-suggest>
<dial-declare context-key="suggestDecisionSuggestion">{"question":"which pumping station should feed zone C at peak demand?","options":[{"id":"tk-halli","meaning":"the TK Halli pumping station on the primary rising main"},{"id":"harohalli","meaning":"the Harohalli intermediate pumping station"},{"id":"tataguni","meaning":"the Tataguni pumping station nearer the city"}]}</dial-declare>
</dial>