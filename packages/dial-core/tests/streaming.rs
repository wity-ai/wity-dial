// A reply read as it arrives (streamed): parsing what has come so far gives the elements that are complete — whole, as
// they will be in the end, in order — and only adds to them as more comes. What a surface may say or show at once.
use dial_core::parse;

/// The elements read from a text, each as JSON (to compare them whole).
fn elements(text: &str) -> Vec<String> {
    parse(text)
        .expect("parses")
        .map(|env| env.elements.iter().map(|e| serde_json::to_string(e).unwrap()).collect())
        .unwrap_or_default()
}

/// Every prefix of a reply, cut at each character.
fn prefixes(text: &str) -> impl Iterator<Item = &str> {
    text.char_indices().map(|(i, _)| i).chain(std::iter::once(text.len())).map(move |end| &text[..end])
}

const REPLIES: &[&str] = &[
    r#"<dial version="1" actor="sage"><dial-inform>Here's what I found.</dial-inform><dial-ask response-type="choice">Which one?<dial-option value="a">Alpha</dial-option><dial-option value="b" default="true">Beta</dial-option></dial-ask></dial>"#,
    r#"<dial-inform>That's publishing — bringing in Avvai.</dial-inform>
<dial-delegate to="avvai-publishing-assistant-jity-6cd4b24c" intent="which accounts can publish"></dial-delegate>"#,
    r#"<dial><dial-suggest action="media.make" render="card-list">Make it a 15-second reel?<dial-payload>{"seconds":15}</dial-payload></dial-suggest><dial-acknowledge of="p1">Done — it's in your compositions.</dial-acknowledge><dial-phatic signal="thinking"/></dial>"#,
    r#"Sure. <dial><dial-declare context-key="brand">Wity<dial-payload>{"tone":"calm"}</dial-payload></dial-declare><dial-execute id="e1"><step env="node" id="s1">echo hi</step></dial-execute><dial-inform>Ünïcödé — “quoted” ✓ 日本語</dial-inform></dial> Thanks!"#,
];

#[test]
fn what_has_come_so_far_is_the_reply_s_first_elements_whole_and_in_order() {
    for reply in REPLIES {
        let all = elements(reply);
        assert!(!all.is_empty());
        for so_far in prefixes(reply) {
            let read = elements(so_far);
            assert!(read.len() <= all.len(), "more elements than the reply has: {so_far:?}");
            assert_eq!(read[..], all[..read.len()], "not the reply's first elements, whole: {so_far:?}");
        }
    }
}

#[test]
fn as_more_comes_the_elements_only_grow() {
    for reply in REPLIES {
        let mut before: Vec<String> = Vec::new();
        for so_far in prefixes(reply) {
            let read = elements(so_far);
            assert!(read.len() >= before.len() && read[..before.len()] == before[..], "an element changed or went: {so_far:?}");
            before = read;
        }
    }
}

#[test]
fn an_element_is_read_only_once_it_is_closed() {
    let reply = "<dial><dial-inform>First.</dial-inform><dial-inform>Second, still coming</dial-inform></dial>";
    let closed_at = reply.find("</dial-inform><dial-inform>").unwrap() + "</dial-inform>".len();
    assert_eq!(elements(&reply[..closed_at - 1]).len(), 0, "read before its closing tag was whole");
    assert_eq!(elements(&reply[..closed_at]).len(), 1);
    let second_closed = reply.rfind("</dial-inform>").unwrap() + "</dial-inform>".len();
    assert_eq!(elements(&reply[..second_closed - 1]).len(), 1);
    assert_eq!(elements(&reply[..second_closed]).len(), 2);
}

#[test]
fn an_unfinished_element_lets_nothing_inside_it_out() {
    // an ask not closed yet, with a whole option inside it: nothing read but what came before
    let so_far = r#"<dial><dial-inform>a</dial-inform><dial-ask>Which?<dial-option value="x">X</dial-option>"#;
    assert_eq!(elements(so_far).len(), 1);
}
