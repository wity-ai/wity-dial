//! An act's condition of satisfaction (`until`): what must hold for it to be done — it is performed again, while what
//! it observes recurs, until this holds.
//!
//!   runs >= N     done once it has been performed N times
//!
//! One form today; a condition that is not one of the forms is refused by name (`condition`), never read as "no
//! condition" — an act that should stop must not run for ever.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Condition {
    /// Done once performed `at_least` times.
    Runs {
        #[serde(rename = "atLeast")]
        at_least: u32,
    },
}

impl Condition {
    /// Whether it holds, given how many times the act has been performed.
    pub fn holds(&self, runs: u32) -> bool {
        match self {
            Condition::Runs { at_least } => runs >= *at_least,
        }
    }

    /// As written in `until`.
    pub fn to_text(&self) -> String {
        match self {
            Condition::Runs { at_least } => format!("runs >= {}", at_least),
        }
    }
}

/// Read an `until`: its condition, or why it is not one.
pub fn condition(text: &str) -> Result<Condition, String> {
    let t = text.trim();
    static RUNS: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let runs = RUNS.get_or_init(|| regex::Regex::new(r"^runs\s*>=\s*(\d+)$").unwrap());
    if let Some(c) = runs.captures(t) {
        return c[1]
            .parse()
            .map(|n| Condition::Runs { at_least: n })
            .map_err(|_| format!("'{}': the count is too large", t));
    }
    Err(format!("'{}' is not a condition DIAL reads (runs >= N)", t))
}
