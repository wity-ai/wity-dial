use dial_core::{condition, parse, serialize, Condition};
use dial_core::types::DialElement;

/// The envelope as data — what must survive being written and read back (`raw` is the text it was read from).
fn data(text: &str) -> serde_json::Value {
    let mut v = serde_json::to_value(parse(text).unwrap().expect("an envelope")).unwrap();
    v.as_object_mut().unwrap().remove("raw");
    v
}

const HOSTILE: &str = r#"Say "it's <b>bold</b> & {{topic}}" — </step></dial-execute></dial> isn't the end"#;

#[test]
fn every_kind_of_act_is_written_and_read_back_the_same() {
    let src = r#"<dial version="1" actor="author">
      <dial-inform id="i" by="narrator" render="card">Hello<dial-payload>{"a":1}</dial-payload></dial-inform>
      <dial-ask id="q" addressed-to="initiator" context-key="chapters" response-type="choice" timeout="60" observe="start" yield="chapters asked">How many?<dial-option value="3" default="true">Three</dial-option><dial-option value="5">Five</dial-option></dial-ask>
      <dial-execute id="x" by="system" observe="idea" yield="angle" until="runs >= 3" unit="one"><step env="board" action="contemplate" label="Thinking…">Find an angle on {{topic}}</step></dial-execute>
      <dial-suggest render="card-list" action="card.add">Add a card<dial-payload>{"title":"Plan"}</dial-payload></dial-suggest>
      <dial-declare context-key="tone">warm</dial-declare>
      <dial-acknowledge of="s1">ok</dial-acknowledge>
      <dial-delegate to="editor" intent="polish">please</dial-delegate>
      <dial-phatic signal="thinking"></dial-phatic>
    </dial>"#;
    let once = data(src);
    let again = data(&serialize(&parse(src).unwrap().unwrap()));
    assert_eq!(once, again);
    let els = once["elements"].as_array().unwrap();
    assert_eq!(els.len(), 8);
    // what was written is what was read — not two readings that lost the same thing
    assert_eq!(once["attributes"]["actor"], "author");
    assert_eq!(els[0]["by"], "narrator");
    assert_eq!(els[0]["payload"]["a"], 1);
    assert_eq!(els[1]["addressedTo"], "initiator");
    assert_eq!(els[1]["contextKey"], "chapters");
    assert_eq!(els[1]["timeout"], 60);
    assert_eq!(els[1]["options"][0]["default"], true);
    assert_eq!(els[1]["yield"], serde_json::json!(["chapters", "asked"]));
    assert_eq!(els[2]["until"], "runs >= 3");
    assert_eq!(els[2]["unit"], "one");
    assert_eq!(els[2]["steps"][0]["action"], "contemplate");
    assert_eq!(els[2]["steps"][0]["label"], "Thinking…");
    assert_eq!(els[2]["steps"][0]["command"], "Find an angle on {{topic}}");
    assert_eq!(els[3]["action"], "card.add");
    assert_eq!(els[4]["contextKey"], "tone");
    assert_eq!(els[5]["of"], "s1");
    assert_eq!(els[6]["to"], "editor");
    assert_eq!(els[7]["signal"], "thinking");
}

#[test]
fn any_words_are_carried_exactly_in_text_attributes_and_payloads() {
    let mut env = parse(r#"<dial><dial-execute id="x"><step env="board" action="contemplate" label="l">c</step></dial-execute><dial-inform>t<dial-payload>{"k":"v"}</dial-payload></dial-inform></dial>"#).unwrap().unwrap();
    if let DialElement::Execute(e) = &mut env.elements[0] {
        e.base.observe = Some(HOSTILE.into());
        e.steps[0].command = HOSTILE.into();
        e.steps[0].label = Some(HOSTILE.into());
    }
    if let DialElement::Inform(e) = &mut env.elements[1] {
        e.text = Some(HOSTILE.into());
        e.payload = Some(serde_json::json!({ "words": HOSTILE }));
    }
    let back = parse(&serialize(&env)).unwrap().unwrap();
    let DialElement::Execute(e) = &back.elements[0] else { panic!() };
    assert_eq!(e.base.observe.as_deref(), Some(HOSTILE));
    assert_eq!(e.steps[0].command, HOSTILE);
    assert_eq!(e.steps[0].label.as_deref(), Some(HOSTILE));
    let DialElement::Inform(i) = &back.elements[1] else { panic!() };
    assert_eq!(i.text.as_deref(), Some(HOSTILE));
    assert_eq!(i.payload.as_ref().unwrap()["words"], HOSTILE);
}

#[test]
fn an_attribute_may_hold_the_other_kind_of_quote() {
    let env = parse(r#"<dial><dial-execute><step env="board" label="Ollie's turn" id='say "hi"'>c</step></dial-execute></dial>"#).unwrap().unwrap();
    let DialElement::Execute(e) = &env.elements[0] else { panic!() };
    assert_eq!(e.steps[0].label.as_deref(), Some("Ollie's turn"));
    assert_eq!(e.steps[0].id.as_deref(), Some("say \"hi\""));
}

#[test]
fn an_attribute_is_read_by_its_own_name_only() {
    let env = parse(r#"<dial><dial-delegate addressed-to="reviewer" to="editor">x</dial-delegate></dial>"#).unwrap().unwrap();
    let DialElement::Delegate(d) = &env.elements[0] else { panic!() };
    assert_eq!(d.to.as_deref(), Some("editor"));
    assert_eq!(d.base.addressed_to.as_deref(), Some("reviewer"));
}

#[test]
fn a_reply_that_is_not_well_formed_xml_reads_as_written() {
    let env = parse("<dial><dial-inform>Q&A at 5 & beyond; R&amp;D</dial-inform></dial>").unwrap().unwrap();
    let DialElement::Inform(i) = &env.elements[0] else { panic!() };
    assert_eq!(i.text.as_deref(), Some("Q&A at 5 & beyond; R&D"));
}

#[test]
fn a_condition_is_read_or_refused_by_name() {
    assert_eq!(condition("runs >= 3"), Ok(Condition::Runs { at_least: 3 }));
    assert_eq!(condition(" runs>=1 ").unwrap().to_text(), "runs >= 1");
    assert!(Condition::Runs { at_least: 2 }.holds(2));
    assert!(!Condition::Runs { at_least: 2 }.holds(1));
    assert!(condition("forever").unwrap_err().contains("forever"));
    assert!(condition("runs >= -1").is_err());
}

#[test]
fn a_quoted_value_may_hold_a_closing_bracket() {
    let env = parse(r#"<dial><dial-execute until="runs >= 2" id="x"><step env="board" label="a > b" action="contemplate">c</step></dial-execute><dial-acknowledge of="a>b"/></dial>"#).unwrap().unwrap();
    let DialElement::Execute(e) = &env.elements[0] else { panic!() };
    assert_eq!(e.base.until.as_deref(), Some("runs >= 2"));
    assert_eq!(e.base.id.as_deref(), Some("x"));
    assert_eq!(e.steps[0].label.as_deref(), Some("a > b"));
    assert_eq!(e.steps[0].action.as_deref(), Some("contemplate"));
    let DialElement::Acknowledge(a) = &env.elements[1] else { panic!() };
    assert_eq!(a.of.as_deref(), Some("a>b"));
}
