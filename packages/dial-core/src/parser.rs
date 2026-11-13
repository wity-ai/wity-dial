use crate::types::*;
use crate::error::DialError;
use crate::escape::unescape;
use regex::Regex;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap};
use std::sync::OnceLock;

/// A fixed pattern, compiled once — on first use — however often a reply is parsed (a streamed reply is parsed again as
/// each piece of it arrives). The same pattern as written; only when it is compiled changes.
macro_rules! re {
    ($pattern:expr) => {{
        static RE: OnceLock<Regex> = OnceLock::new();
        RE.get_or_init(|| Regex::new($pattern).unwrap())
    }};
}

// An open tag's attributes: anything up to its `>` — but a quoted value may hold a `>` (until="runs >= 3"), so a
// quoted value is skipped whole.
thread_local! {
    // an attribute's pattern, by its name — compiled once each (the names are the protocol's own, a handful)
    static ATTR_RES: RefCell<HashMap<String, Regex>> = RefCell::new(HashMap::new());
}

/// Extract and parse a <dial> envelope from AI response text.
/// Returns None if no DIAL envelope is found — caller falls back to plain text handling.
pub fn parse(text: &str) -> Result<Option<DialEnvelope>, DialError> {
    let raw = match extract_dial_block(text) {
        Some(r) => r,
        None => return Ok(None),
    };

    let attributes = parse_root_attributes(&raw);
    let elements = parse_elements(&raw)?;

    Ok(Some(DialEnvelope {
        attributes,
        elements,
        raw,
    }))
}

/// Return the prose portions of a response — text outside any <dial> block (or, with no envelope, outside the
/// span of its DIAL elements: bare_elements).
pub fn extract_prose(text: &str) -> String {
    let re = re!(r"<dial[\s\S]*?</dial>");
    if re.is_match(text) {
        return re.replace_all(text, "").trim().to_string();
    }
    match bare_elements(text) {
        Some((start, end)) => format!("{} {}", &text[..start], &text[end..]).trim().to_string(),
        None => text.trim().to_string(),
    }
}

fn extract_dial_block(text: &str) -> Option<String> {
    let re = re!(r"(?s)<dial[\s\S]*?</dial>");
    if let Some(m) = re.find(text) {
        return Some(m.as_str().to_string());
    }
    // a reply whose DIAL elements came without their <dial> envelope (a model's slip): read as if enveloped — the
    // elements and their meaning unchanged, only the missing wrapper forgiven (one rule, here, for every surface)
    bare_elements(text).map(|(start, end)| format!("<dial>{}</dial>", &text[start..end]))
}

/// With no <dial> envelope: where the reply's DIAL elements are — from the first <dial-…> element to the end of the
/// last (its closing tag, or a self-closing one). None when there are none.
fn bare_elements(text: &str) -> Option<(usize, usize)> {
    let open = re!(r"<dial-[\w]+[\s>/]");
    let start = open.find(text)?.start();
    let ends = re!(r#"</dial-[\w]+>|<dial-[\w]+(?:[^>"']|"[^"]*"|'[^']*')*/>"#);
    let end = ends.find_iter(&text[start..]).map(|m| start + m.end()).last()?;
    Some((start, end))
}

fn parse_root_attributes(xml: &str) -> DialAttributes {
    let open_tag_re = re!(r#"<dial((?:[^>"']|"[^"]*"|'[^']*')*)>"#);
    let attrs_str = open_tag_re
        .captures(xml)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str())
        .unwrap_or("");

    DialAttributes {
        version: attr(attrs_str, "version"),
        turn: attr(attrs_str, "turn").and_then(|v| v.parse().ok()),
        actor: attr(attrs_str, "actor"),
        session: attr(attrs_str, "session"),
    }
}

fn parse_elements(xml: &str) -> Result<Vec<DialElement>, DialError> {
    // Strip root <dial ...> and </dial>
    let open_re = re!(r#"^<dial(?:[^>"']|"[^"]*"|'[^']*')*>"#);
    let inner = open_re.replace(xml, "");
    let inner = inner.trim_end_matches("</dial>").trim();

    let mut elements = Vec::new();

    // Find each <dial-* opening (or self-closing) tag; no backreference needed.
    // Rust's regex crate does not support backreferences (\1), so we find the
    // matching closing tag manually using str::find after the opening tag.
    let open_tag_re = re!(r#"<(dial-[\w]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(/?>)"#);
    let mut search = inner;

    loop {
        let Some(cap) = open_tag_re.captures(search) else { break };

        let tag_match = cap.get(0).unwrap();
        let tag_name  = cap[1].to_string();
        let attrs     = cap[2].to_string();
        let close_br  = cap[3].to_string();
        let after_open = tag_match.end();

        let (content, consumed) = if close_br == "/>" {
            // Self-closing: no content
            (String::new(), after_open)
        } else {
            let closing = format!("</{}>", tag_name);
            let rest = &search[after_open..];
            if let Some(close_idx) = rest.find(closing.as_str()) {
                (rest[..close_idx].to_string(), after_open + close_idx + closing.len())
            } else {
                // Malformed — no closing tag; skip past the '<' and keep scanning
                search = &search[tag_match.start() + 1..];
                continue;
            }
        };

        if let Some(el) = parse_element(&tag_name, &attrs, &content)? {
            elements.push(el);
        }

        search = &search[consumed..];
    }

    Ok(elements)
}

fn parse_element(tag: &str, attrs: &str, inner: &str) -> Result<Option<DialElement>, DialError> {
    let r#yield: Option<Vec<String>> = attr(attrs, "yield").map(|y| y.split_whitespace().map(String::from).collect());
    let yield_of = parse_yields(inner, attr(attrs, "id").as_deref(), r#yield.as_deref().unwrap_or(&[]))?;
    // what it says of its yields is not its words
    let stripped = re!(r#"<dial-yield(?:[^>"']|"[^"]*"|'[^']*')*?/>"#).replace_all(inner, "").to_string();
    let inner = stripped.as_str();
    let base = ElementBase {
        id: attr(attrs, "id"),
        observe: attr(attrs, "observe"),
        r#yield,
        yield_of,
        addressed_to: attr(attrs, "addressed-to"),
        by: attr(attrs, "by"),
        until: attr(attrs, "until"),
        unit: attr(attrs, "unit"),
    };
    // an element's words, as written: its entities read back
    let words = |s: &str| Some(unescape(s.trim())).filter(|s| !s.is_empty());

    let el = match tag {
        "dial-inform" => DialElement::Inform(DialInform {
            base,
            render: attr(attrs, "render").unwrap_or_else(|| "prose".into()),
            text: words(&strip_payload_tags(inner)),
            payload: parse_payload(inner),
        }),

        "dial-ask" => {
            let options = parse_options(inner);
            let text_only = re!(r"(?s)<dial-option[\s\S]*?</dial-option>").replace_all(inner, "");
            DialElement::Ask(DialAsk {
                base,
                context_key: attr(attrs, "context-key"),
                response_type: attr(attrs, "response-type").unwrap_or_else(|| "text".into()),
                timeout: attr(attrs, "timeout").and_then(|v| v.parse().ok()),
                text: words(&text_only),
                options,
            })
        }

        "dial-execute" => DialElement::Execute(DialExecute {
            base,
            steps: parse_steps(inner),
        }),

        "dial-suggest" => DialElement::Suggest(DialSuggest {
            base,
            render: attr(attrs, "render").unwrap_or_else(|| "card-list".into()),
            action: attr(attrs, "action"),
            text: words(&strip_payload_tags(inner)),
            payload: parse_payload(inner),
        }),

        "dial-declare" => DialElement::Declare(DialDeclare {
            base,
            context_key: attr(attrs, "context-key"),
            text: words(&strip_payload_tags(inner)),
            payload: parse_payload(inner),
        }),

        "dial-acknowledge" => DialElement::Acknowledge(DialAcknowledge {
            base,
            of: attr(attrs, "of"),
            text: words(inner),
        }),

        "dial-delegate" => DialElement::Delegate(DialDelegate {
            base,
            to: attr(attrs, "to"),
            intent: attr(attrs, "intent"),
            text: words(inner),
        }),

        "dial-phatic" => DialElement::Phatic(DialPhatic {
            base,
            signal: attr(attrs, "signal"),
        }),

        _ => return Ok(None),
    };

    Ok(Some(el))
}

/// An act's `<dial-yield name="…" …/>` elements, by name — each a name the act yields, said once.
fn parse_yields(inner: &str, id: Option<&str>, names: &[String]) -> Result<Option<BTreeMap<String, DialYield>>, DialError> {
    let re = re!(r#"<dial-yield((?:[^>"']|"[^"]*"|'[^']*')*?)/>"#);
    let act = id.map(|i| format!("Act '{}'", i)).unwrap_or_else(|| "An act".into());
    let mut out = BTreeMap::new();
    for cap in re.captures_iter(inner) {
        let a = &cap[1];
        let Some(name) = attr(a, "name").filter(|n| !n.is_empty()) else {
            return Err(DialError::Parse(format!("{act}: a dial-yield names the yield it is (name)")));
        };
        if !names.iter().any(|n| n == &name) {
            return Err(DialError::Parse(format!("{act}: dial-yield '{name}' is not a yield of it (yield=\"{}\")", names.join(" "))));
        }
        let y = DialYield { role: attr(a, "role"), make: attr(a, "make"), model: attr(a, "model") };
        if out.insert(name.clone(), y).is_some() {
            return Err(DialError::Parse(format!("{act}: dial-yield '{name}' said twice")));
        }
    }
    Ok(if out.is_empty() { None } else { Some(out) })
}

fn parse_steps(inner: &str) -> Vec<DialStep> {
    let re = re!(r#"(?s)<step((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)</step>"#);
    re.captures_iter(inner)
        .map(|cap| {
            let attrs = &cap[1];
            let command = unescape(cap[2].trim());
            DialStep {
                env: attr(attrs, "env").unwrap_or_else(|| "shell".into()),
                action: attr(attrs, "action"),
                id: attr(attrs, "id"),
                label: attr(attrs, "label"),
                observe: attr(attrs, "observe"),
                r#yield: attr(attrs, "yield")
                    .map(|y| y.split_whitespace().map(String::from).collect()),
                command,
            }
        })
        .collect()
}

fn parse_options(inner: &str) -> Vec<DialOption> {
    let re = re!(r#"(?s)<dial-option((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)</dial-option>"#);
    re.captures_iter(inner)
        .map(|cap| {
            let attrs = &cap[1];
            let label = unescape(cap[2].trim());
            DialOption {
                value: attr(attrs, "value").unwrap_or_else(|| label.clone()),
                label,
                default: attr(attrs, "default").as_deref() == Some("true"),
            }
        })
        .collect()
}

fn parse_payload(inner: &str) -> Option<serde_json::Value> {
    let re = re!(r"(?s)<dial-payload[^>]*>([\s\S]*?)</dial-payload>");
    re.captures(inner)
        .and_then(|c| c.get(1))
        .and_then(|m| serde_json::from_str(&unescape(m.as_str().trim())).ok())
}

fn strip_payload_tags(inner: &str) -> String {
    let re = re!(r"(?s)<dial-payload[\s\S]*?</dial-payload>");
    re.replace_all(inner, "").to_string()
}

/// Parse a single attribute value from an attribute string — in either quotes (the other kind may be inside it:
/// label="Ollie's"), its entities read back. The name stands alone: `id` is not read from `data-id`.
pub fn attr(attrs: &str, name: &str) -> Option<String> {
    ATTR_RES.with(|cache| {
        let mut cache = cache.borrow_mut();
        let re = cache.entry(name.to_string()).or_insert_with(|| {
            let pattern = format!(r#"(?:^|\s){}\s*=\s*(?:"([^"]*)"|'([^']*)')"#, regex::escape(name));
            Regex::new(&pattern).unwrap()
        });
        re.captures(attrs)
            .and_then(|c| c.get(1).or_else(|| c.get(2)))
            .map(|m| unescape(m.as_str()))
    })
}
