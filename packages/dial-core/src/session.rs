use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Result of a single dial-execute step — environment-discovered fact.
/// Orthogonal to dial-declare (AI-asserted fact). Not conflated.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub command: String,
    pub env: String,
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Per-session store for DIAL context across turns.
///
/// Two orthogonal streams:
///   declared  — AI-asserted facts via <dial-declare>. Persist across turns.
///   results   — Environment-discovered facts from <dial-execute>. Rolling window.
#[derive(Debug, Default)]
pub struct DialSessionContext {
    declared: HashMap<String, serde_json::Value>,
    results: Vec<ExecutionResult>,
}

impl DialSessionContext {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn declare(&mut self, key: String, value: serde_json::Value) {
        self.declared.insert(key, value);
    }

    pub fn get_declared(&self) -> &HashMap<String, serde_json::Value> {
        &self.declared
    }

    pub fn record_results(&mut self, new_results: Vec<ExecutionResult>) {
        self.results.extend(new_results);
        // Rolling window — keep last 10
        let len = self.results.len();
        if len > 10 {
            self.results.drain(0..len - 10);
        }
    }

    pub fn get_last_results(&self) -> &[ExecutionResult] {
        &self.results
    }

    pub fn clear(&mut self) {
        self.declared.clear();
        self.results.clear();
    }
}
