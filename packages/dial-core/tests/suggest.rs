use dial_core::parse;
use dial_core::types::DialElement;

fn suggest(xml: &str) -> dial_core::types::DialSuggest {
    let env = parse(xml).expect("parses").expect("has an envelope");
    match env.elements.into_iter().next().expect("one element") {
        DialElement::Suggest(s) => s,
        other => panic!("not a suggest: {:?}", other),
    }
}

#[test]
fn suggest_keeps_its_text_as_the_human_proposal() {
    let s = suggest(r#"<dial><dial-suggest action="matrix.entry.add">Add 'Strong brand' to Strengths?</dial-suggest></dial>"#);
    assert_eq!(s.action.as_deref(), Some("matrix.entry.add"));
    assert_eq!(s.text.as_deref(), Some("Add 'Strong brand' to Strengths?"));
    assert!(s.payload.is_none());
}

#[test]
fn suggest_text_excludes_the_payload_and_payload_still_parses() {
    let s = suggest(r#"<dial><dial-suggest action="add-to-cart">Top picks <dial-payload type="application/json">[{"id":"sku-1"}]</dial-payload></dial-suggest></dial>"#);
    assert_eq!(s.text.as_deref(), Some("Top picks"));
    assert_eq!(s.payload, Some(serde_json::json!([{ "id": "sku-1" }])));
}

#[test]
fn suggest_without_text_is_unchanged() {
    let s = suggest(r#"<dial><dial-suggest action="x"><dial-payload type="application/json">[1]</dial-payload></dial-suggest></dial>"#);
    assert!(s.text.is_none());
    assert_eq!(s.payload, Some(serde_json::json!([1])));
}
