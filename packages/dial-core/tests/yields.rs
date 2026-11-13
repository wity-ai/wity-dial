use dial_core::{parse, serialize};

fn data(text: &str) -> serde_json::Value {
    let mut v = serde_json::to_value(parse(text).unwrap().expect("an envelope")).unwrap();
    v.as_object_mut().unwrap().remove("raw");
    v
}

#[test]
fn what_an_act_says_of_its_yields_is_read_written_and_read_back_the_same() {
    let src = r#"<dial>
      <dial-execute id="draft" observe="idea" yield="title body cover notes"><dial-yield name="cover" part="poster" make="image" model="text-to-image"/><dial-yield name="title" part="title content"/><step env="board" action="contemplate">Write it</step></dial-execute>
      <dial-ask id="q" yield="answer"><dial-yield name="answer" part="question title"/>Which?<dial-option value="a">A</dial-option></dial-ask>
    </dial>"#;
    let once = data(src);
    let els = once["elements"].as_array().unwrap();
    assert_eq!(els[0]["yield"], serde_json::json!(["title", "body", "cover", "notes"]));
    assert_eq!(els[0]["yieldOf"]["cover"], serde_json::json!({ "part": ["poster"], "make": "image", "model": "text-to-image" }));
    assert_eq!(els[0]["yieldOf"]["title"], serde_json::json!({ "part": ["title", "content"], "make": null, "model": null }));
    assert!(els[0]["yieldOf"].get("body").is_none());
    // its words and its steps are its own: what it says of its yields is not in them
    assert_eq!(els[0]["steps"][0]["command"], "Write it");
    assert_eq!(els[1]["text"], "Which?");
    assert_eq!(els[1]["options"][0]["label"], "A");
    let written = serialize(&parse(src).unwrap().unwrap());
    // written in the order it yields them
    assert!(written.find(r#"name="title""#).unwrap() < written.find(r#"name="cover""#).unwrap());
    assert_eq!(data(&written), once);
}

#[test]
fn an_act_that_says_nothing_of_its_yields_is_written_as_before() {
    let src = r#"<dial><dial-execute id="x" yield="a b"><step env="board" action="contemplate">Go</step></dial-execute></dial>"#;
    let env = parse(src).unwrap().unwrap();
    let written = serialize(&env);
    assert!(!written.contains("dial-yield"));
    assert_eq!(data(&written)["elements"][0]["yieldOf"], serde_json::Value::Null);
}

#[test]
fn a_yield_described_that_the_act_does_not_yield_is_refused_by_name() {
    let err = parse(r#"<dial><dial-execute id="x" yield="a"><dial-yield name="b" part="title"/><step env="board">Go</step></dial-execute></dial>"#).unwrap_err();
    assert!(err.to_string().contains("Act 'x': dial-yield 'b' is not a yield of it"), "{err}");
}

#[test]
fn a_yield_described_twice_or_unnamed_is_refused() {
    let twice = parse(r#"<dial><dial-execute id="x" yield="a"><dial-yield name="a" part="title"/><dial-yield name="a" part="content"/><step env="board">Go</step></dial-execute></dial>"#).unwrap_err();
    assert!(twice.to_string().contains("'a' said twice"), "{twice}");
    let unnamed = parse(r#"<dial><dial-execute id="x" yield="a"><dial-yield part="title"/><step env="board">Go</step></dial-execute></dial>"#).unwrap_err();
    assert!(unnamed.to_string().contains("names the yield it is"), "{unnamed}");
}
