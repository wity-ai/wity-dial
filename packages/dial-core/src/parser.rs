use crate::types::*;
use crate::error::DialError;
use regex::Regex;

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

/// Return the prose portions of a response — text outside any <dial> block.
pub fn extract_prose(text: &str) -> String {
    let re = Regex::new(r"<dial[\s\S]*?</dial>").unwrap();
    re.replace_all(text, "").trim().to_string()
}

fn extract_dial_block(text: &str) -> Option<String> {
    let re = Regex::new(r"(?s)<dial[\s\S]*?</dial>").unwrap();
    re.find(text).map(|m| m.as_str().to_string())
}

fn parse_root_attributes(xml: &str) -> DialAttributes {
    let open_tag_re = Regex::new(r"<dial([^>]*)>").unwrap();
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
    let open_re = Regex::new(r"^<dial[^>]*>").unwrap();
    let inner = open_re.replace(xml, "");
    let inner = inner.trim_end_matches("</dial>").trim();

    let mut elements = Vec::new();

    // Find each <dial-* opening (or self-closing) tag; no backreference needed.
    // Rust's regex crate does not support backreferences (\1), so we find the
    // matching closing tag manually using str::find after the opening tag.
    let open_tag_re = Regex::new(r"<(dial-[\w]+)([^>]*?)(/?>)").unwrap();
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
    let base = ElementBase {
        id: attr(attrs, "id"),
        observe: attr(attrs, "observe"),
        r#yield: attr(attrs, "yield").map(|y| y.split_whitespace().map(String::from).collect()),
        addressed_to: attr(attrs, "addressed-to"),
    };

    let el = match tag {
        "dial-inform" => DialElement::Inform(DialInform {
            base,
            render: attr(attrs, "render").unwrap_or_else(|| "prose".into()),
            text: Some(strip_payload_tags(inner).trim().to_string()).filter(|s| !s.is_empty()),
            payload: parse_payload(inner),
        }),

        "dial-ask" => {
            let options = parse_options(inner);
            let text_only = Regex::new(r"(?s)<dial-option[\s\S]*?</dial-option>")
                .unwrap()
                .replace_all(inner, "")
                .trim()
                .to_string();
            DialElement::Ask(DialAsk {
                base,
                response_type: attr(attrs, "response-type").unwrap_or_else(|| "text".into()),
                timeout: attr(attrs, "timeout").and_then(|v| v.parse().ok()),
                text: Some(text_only).filter(|s| !s.is_empty()),
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
            text: Some(strip_payload_tags(inner).trim().to_string()).filter(|s| !s.is_empty()),
            payload: parse_payload(inner),
        }),

        "dial-declare" => DialElement::Declare(DialDeclare {
            base,
            context_key: attr(attrs, "context-key"),
            text: Some(strip_payload_tags(inner).trim().to_string()).filter(|s| !s.is_empty()),
            payload: parse_payload(inner),
        }),

        "dial-acknowledge" => DialElement::Acknowledge(DialAcknowledge {
            base,
            of: attr(attrs, "of"),
            text: Some(inner.trim().to_string()).filter(|s| !s.is_empty()),
        }),

        "dial-delegate" => DialElement::Delegate(DialDelegate {
            base,
            to: attr(attrs, "to"),
            intent: attr(attrs, "intent"),
            text: Some(inner.trim().to_string()).filter(|s| !s.is_empty()),
        }),

        "dial-phatic" => DialElement::Phatic(DialPhatic {
            base,
            signal: attr(attrs, "signal"),
        }),

        _ => return Ok(None),
    };

    Ok(Some(el))
}

fn parse_steps(inner: &str) -> Vec<DialStep> {
    let re = Regex::new(r"(?s)<step([^>]*)>([\s\S]*?)</step>").unwrap();
    re.captures_iter(inner)
        .map(|cap| {
            let attrs = &cap[1];
            let command = cap[2].trim().to_string();
            DialStep {
                env: attr(attrs, "env").unwrap_or_else(|| "shell".into()),
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
    let re = Regex::new(r"(?s)<dial-option([^>]*)>([\s\S]*?)</dial-option>").unwrap();
    re.captures_iter(inner)
        .map(|cap| {
            let attrs = &cap[1];
            let label = cap[2].trim().to_string();
            DialOption {
                value: attr(attrs, "value").unwrap_or_else(|| label.clone()),
                label,
                default: attr(attrs, "default").as_deref() == Some("true"),
            }
        })
        .collect()
}

fn parse_payload(inner: &str) -> Option<serde_json::Value> {
    let re = Regex::new(r"(?s)<dial-payload[^>]*>([\s\S]*?)</dial-payload>").unwrap();
    re.captures(inner)
        .and_then(|c| c.get(1))
        .and_then(|m| serde_json::from_str(m.as_str().trim()).ok())
}

fn strip_payload_tags(inner: &str) -> String {
    let re = Regex::new(r"(?s)<dial-payload[\s\S]*?</dial-payload>").unwrap();
    re.replace_all(inner, "").to_string()
}

/// Parse a single attribute value from an attribute string.
pub fn attr(attrs: &str, name: &str) -> Option<String> {
    let pattern = format!(r#"{}=["']([^"']*)["']"#, regex::escape(name));
    let re = Regex::new(&pattern).unwrap();
    re.captures(attrs)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}
