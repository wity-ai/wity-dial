//! A DIAL envelope written as text — what `parse` reads back to the same envelope (its `raw` aside). One canonical
//! form: attributes in a fixed order, only those that are set; words and attribute values escaped (`escape`), so any
//! text is carried exactly; a payload as JSON. For storing an exchange (an agent's blueprint) and handing it on.

use crate::escape::{escape_attr, escape_text};
use crate::types::*;

pub fn serialize(envelope: &DialEnvelope) -> String {
    let a = &envelope.attributes;
    let mut out = String::from("<dial");
    push_attr(&mut out, "version", a.version.as_deref());
    push_attr(&mut out, "turn", a.turn.map(|t| t.to_string()).as_deref());
    push_attr(&mut out, "actor", a.actor.as_deref());
    push_attr(&mut out, "session", a.session.as_deref());
    out.push_str(">\n");
    for el in &envelope.elements {
        out.push_str("  ");
        out.push_str(&element(el));
        out.push('\n');
    }
    out.push_str("</dial>");
    out
}

fn push_attr(out: &mut String, name: &str, value: Option<&str>) {
    if let Some(v) = value {
        out.push_str(&format!(" {}=\"{}\"", name, escape_attr(v)));
    }
}

fn base_attrs(out: &mut String, b: &ElementBase) {
    push_attr(out, "id", b.id.as_deref());
    push_attr(out, "by", b.by.as_deref());
    push_attr(out, "addressed-to", b.addressed_to.as_deref());
    push_attr(out, "observe", b.observe.as_deref());
    push_attr(out, "yield", b.r#yield.as_ref().map(|y| y.join(" ")).as_deref());
    push_attr(out, "until", b.until.as_deref());
    push_attr(out, "unit", b.unit.as_deref());
}

/// What it says of its yields — a `<dial-yield/>` each, in the order it yields them.
fn yields(b: &ElementBase) -> String {
    let (Some(names), Some(of)) = (b.r#yield.as_ref(), b.yield_of.as_ref()) else { return String::new() };
    names.iter().filter_map(|n| of.get(n).map(|y| {
        let mut a = String::new();
        push_attr(&mut a, "name", Some(n));
        push_attr(&mut a, "part", y.part.as_ref().map(|p| p.join(" ")).as_deref());
        push_attr(&mut a, "make", y.make.as_deref());
        push_attr(&mut a, "model", y.model.as_deref());
        format!("<dial-yield{a}/>")
    })).collect()
}

fn words(text: &Option<String>) -> String {
    text.as_deref().map(escape_text).unwrap_or_default()
}

fn payload(p: &Option<serde_json::Value>) -> String {
    match p {
        Some(v) => format!("<dial-payload>{}</dial-payload>", escape_text(&v.to_string())),
        None => String::new(),
    }
}

fn tag(name: &str, attrs: String, inner: String) -> String {
    format!("<{name}{attrs}>{inner}</{name}>")
}

fn el_base(el: &DialElement) -> &ElementBase {
    match el {
        DialElement::Inform(e) => &e.base, DialElement::Ask(e) => &e.base, DialElement::Execute(e) => &e.base,
        DialElement::Suggest(e) => &e.base, DialElement::Declare(e) => &e.base, DialElement::Acknowledge(e) => &e.base,
        DialElement::Delegate(e) => &e.base, DialElement::Phatic(e) => &e.base,
    }
}

fn element(el: &DialElement) -> String {
    let mut attrs = String::new();
    match el {
        DialElement::Inform(e) => {
            base_attrs(&mut attrs, &e.base);
            push_attr(&mut attrs, "render", Some(&e.render));
            tag("dial-inform", attrs, yields(el_base(el)) + &words(&e.text) + &payload(&e.payload))
        }
        DialElement::Ask(e) => {
            base_attrs(&mut attrs, &e.base);
            push_attr(&mut attrs, "context-key", e.context_key.as_deref());
            push_attr(&mut attrs, "response-type", Some(&e.response_type));
            push_attr(&mut attrs, "timeout", e.timeout.map(|t| t.to_string()).as_deref());
            let options: String = e.options.iter().map(|o| {
                let mut oa = String::new();
                push_attr(&mut oa, "value", Some(&o.value));
                if o.default { push_attr(&mut oa, "default", Some("true")); }
                tag("dial-option", oa, escape_text(&o.label))
            }).collect();
            tag("dial-ask", attrs, yields(el_base(el)) + &words(&e.text) + &options)
        }
        DialElement::Execute(e) => {
            base_attrs(&mut attrs, &e.base);
            let steps: String = e.steps.iter().map(|s| {
                let mut sa = String::new();
                push_attr(&mut sa, "env", Some(&s.env));
                push_attr(&mut sa, "action", s.action.as_deref());
                push_attr(&mut sa, "id", s.id.as_deref());
                push_attr(&mut sa, "label", s.label.as_deref());
                push_attr(&mut sa, "observe", s.observe.as_deref());
                push_attr(&mut sa, "yield", s.r#yield.as_ref().map(|y| y.join(" ")).as_deref());
                tag("step", sa, escape_text(&s.command))
            }).collect();
            tag("dial-execute", attrs, yields(el_base(el)) + &steps)
        }
        DialElement::Suggest(e) => {
            base_attrs(&mut attrs, &e.base);
            push_attr(&mut attrs, "render", Some(&e.render));
            push_attr(&mut attrs, "action", e.action.as_deref());
            tag("dial-suggest", attrs, yields(el_base(el)) + &words(&e.text) + &payload(&e.payload))
        }
        DialElement::Declare(e) => {
            base_attrs(&mut attrs, &e.base);
            push_attr(&mut attrs, "context-key", e.context_key.as_deref());
            tag("dial-declare", attrs, yields(el_base(el)) + &words(&e.text) + &payload(&e.payload))
        }
        DialElement::Acknowledge(e) => {
            base_attrs(&mut attrs, &e.base);
            push_attr(&mut attrs, "of", e.of.as_deref());
            tag("dial-acknowledge", attrs, yields(el_base(el)) + &words(&e.text))
        }
        DialElement::Delegate(e) => {
            base_attrs(&mut attrs, &e.base);
            push_attr(&mut attrs, "to", e.to.as_deref());
            push_attr(&mut attrs, "intent", e.intent.as_deref());
            tag("dial-delegate", attrs, yields(el_base(el)) + &words(&e.text))
        }
        DialElement::Phatic(e) => {
            base_attrs(&mut attrs, &e.base);
            push_attr(&mut attrs, "signal", e.signal.as_deref());
            tag("dial-phatic", attrs, yields(el_base(el)))
        }
    }
}
