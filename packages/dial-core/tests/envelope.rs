use dial_core::{extract_prose, parse};
use dial_core::types::DialElement;

#[test]
fn an_enveloped_reply_parses_as_before() {
    let env = parse(r#"<dial><dial-inform>Hi</dial-inform></dial>"#).unwrap().unwrap();
    assert_eq!(env.elements.len(), 1);
    assert_eq!(env.raw, "<dial><dial-inform>Hi</dial-inform></dial>");
}

#[test]
fn elements_without_their_envelope_are_read_as_if_enveloped() {
    let reply = "<dial-inform>That's publishing — bringing in Avvai.</dial-inform>\n<dial-delegate to=\"avvai-publishing-assistant-jity-6cd4b24c\" intent=\"which accounts can publish\"></dial-delegate>";
    let env = parse(reply).unwrap().expect("read as an envelope");
    assert_eq!(env.elements.len(), 2);
    assert!(matches!(env.elements[0], DialElement::Inform(_)));
    assert!(matches!(env.elements[1], DialElement::Delegate(_)));
}

#[test]
fn prose_around_bare_elements_stays_prose_and_the_elements_are_not() {
    let reply = "Sure.\n<dial-inform>Done.</dial-inform>\nThanks!";
    assert_eq!(extract_prose(reply), "Sure.\n \nThanks!");
    assert_eq!(parse(reply).unwrap().unwrap().elements.len(), 1);
}

#[test]
fn a_self_closing_element_alone_is_an_envelope_too() {
    let env = parse(r#"<dial-acknowledge ref="s1"/>"#).unwrap().expect("read as an envelope");
    assert_eq!(env.elements.len(), 1);
}

#[test]
fn plain_text_has_no_envelope_and_is_all_prose() {
    assert!(parse("Just words, no DIAL.").unwrap().is_none());
    assert_eq!(extract_prose("Just words, no DIAL."), "Just words, no DIAL.");
}
