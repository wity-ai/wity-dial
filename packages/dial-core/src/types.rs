use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialAttributes {
    pub version: Option<String>,
    pub turn: Option<u32>,
    pub actor: Option<String>,
    pub session: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialStep {
    pub env: String,
    /// The operation within its env (a board's `contemplate`, a scene command…) — the same name a person's or an
    /// assistant's request gives it (dial-suggest `action`). None: the env's own reading of `command` (a shell line).
    pub action: Option<String>,
    pub id: Option<String>,
    pub label: Option<String>,
    pub observe: Option<String>,
    pub r#yield: Option<Vec<String>>,
    pub command: String,
}

/// What a yield of an act is, beyond its name (written `<dial-yield name="…" role="…" make="…" model="…"/>` in the act).
/// Each is the receiver's to read: DIAL carries them exactly and checks only that the act yields that name.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct DialYield {
    /// The part of what is being made that it fills (a composition's title, its content, a poll's question…) — named
    /// by what is made, not by DIAL.
    pub role: Option<String>,
    /// What it is made into, when it is not the act's own words: a kind of media (image, video, audio…).
    pub make: Option<String>,
    /// How it is made: a capability (any model that has it, chosen when it is made) or one model's urn (that model).
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialOption {
    pub value: String,
    pub label: String,
    pub default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum DialElement {
    #[serde(rename = "dial-inform")]
    Inform(DialInform),
    #[serde(rename = "dial-ask")]
    Ask(DialAsk),
    #[serde(rename = "dial-execute")]
    Execute(DialExecute),
    #[serde(rename = "dial-suggest")]
    Suggest(DialSuggest),
    #[serde(rename = "dial-declare")]
    Declare(DialDeclare),
    #[serde(rename = "dial-acknowledge")]
    Acknowledge(DialAcknowledge),
    #[serde(rename = "dial-delegate")]
    Delegate(DialDelegate),
    #[serde(rename = "dial-phatic")]
    Phatic(DialPhatic),
}

impl DialElement {
    pub fn id(&self) -> Option<&str> {
        match self {
            DialElement::Inform(e)      => e.base.id.as_deref(),
            DialElement::Ask(e)         => e.base.id.as_deref(),
            DialElement::Execute(e)     => e.base.id.as_deref(),
            DialElement::Suggest(e)     => e.base.id.as_deref(),
            DialElement::Declare(e)     => e.base.id.as_deref(),
            DialElement::Acknowledge(e) => e.base.id.as_deref(),
            DialElement::Delegate(e)    => e.base.id.as_deref(),
            DialElement::Phatic(e)      => e.base.id.as_deref(),
        }
    }

    pub fn observe(&self) -> Option<&str> {
        match self {
            DialElement::Inform(e)      => e.base.observe.as_deref(),
            DialElement::Ask(e)         => e.base.observe.as_deref(),
            DialElement::Execute(e)     => e.base.observe.as_deref(),
            DialElement::Suggest(e)     => e.base.observe.as_deref(),
            DialElement::Declare(e)     => e.base.observe.as_deref(),
            DialElement::Acknowledge(e) => e.base.observe.as_deref(),
            DialElement::Delegate(e)    => e.base.observe.as_deref(),
            DialElement::Phatic(e)      => e.base.observe.as_deref(),
        }
    }

    pub fn yields(&self) -> Option<&Vec<String>> {
        match self {
            DialElement::Inform(e)      => e.base.r#yield.as_ref(),
            DialElement::Ask(e)         => e.base.r#yield.as_ref(),
            DialElement::Execute(e)     => e.base.r#yield.as_ref(),
            DialElement::Suggest(e)     => e.base.r#yield.as_ref(),
            DialElement::Declare(e)     => e.base.r#yield.as_ref(),
            DialElement::Acknowledge(e) => e.base.r#yield.as_ref(),
            DialElement::Delegate(e)    => e.base.r#yield.as_ref(),
            DialElement::Phatic(e)      => e.base.r#yield.as_ref(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ElementBase {
    pub id: Option<String>,
    pub observe: Option<String>,
    #[serde(rename = "yield")]
    pub r#yield: Option<Vec<String>>,
    /// What some of its yields are, beyond their names — by name; each a name in `yield`. None: names only.
    pub yield_of: Option<BTreeMap<String, DialYield>>,
    pub addressed_to: Option<String>,
    /// The role that performs the act (bound to a person, an agent or the system when a session starts). None: the
    /// system.
    pub by: Option<String>,
    /// Its condition of satisfaction: performed again while what it observes recurs, until this holds
    /// (`condition::Condition`). None: every time.
    pub until: Option<String>,
    /// What one unit of its yield is — how its output is segmented into units of meaning. None: the receiver's
    /// default.
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialInform {
    #[serde(flatten)]
    pub base: ElementBase,
    pub render: String,
    pub text: Option<String>,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialAsk {
    #[serde(flatten)]
    pub base: ElementBase,
    /// Where the answer is declared (as dial-declare's context-key): the name later acts read it by.
    pub context_key: Option<String>,
    pub response_type: String,
    pub timeout: Option<u32>,
    pub text: Option<String>,
    pub options: Vec<DialOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialExecute {
    #[serde(flatten)]
    pub base: ElementBase,
    pub steps: Vec<DialStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialSuggest {
    #[serde(flatten)]
    pub base: ElementBase,
    pub render: String,
    pub action: Option<String>,
    /// The human-readable proposal (the element's text content, payload excluded) — what a receiver shows when
    /// asking whether to take the action.
    pub text: Option<String>,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialDeclare {
    #[serde(flatten)]
    pub base: ElementBase,
    pub context_key: Option<String>,
    pub text: Option<String>,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialAcknowledge {
    #[serde(flatten)]
    pub base: ElementBase,
    pub of: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialDelegate {
    #[serde(flatten)]
    pub base: ElementBase,
    pub to: Option<String>,
    pub intent: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialPhatic {
    #[serde(flatten)]
    pub base: ElementBase,
    pub signal: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialEnvelope {
    pub attributes: DialAttributes,
    pub elements: Vec<DialElement>,
    pub raw: String,
}
