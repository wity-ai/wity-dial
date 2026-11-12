use wasm_bindgen::prelude::*;
use dial_core::{condition, extract_prose, parse, serialize, DialEnvelope, DialSessionContext, ExecutionResult};

/// Parse a <dial> envelope from AI response text.
/// Returns JSON string of DialEnvelope, or null if no envelope found.
#[wasm_bindgen]
pub fn dial_parse(text: &str) -> Result<JsValue, JsValue> {
    match parse(text) {
        Ok(Some(envelope)) => {
            let json = serde_json::to_string(&envelope)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            Ok(JsValue::from_str(&json))
        }
        Ok(None) => Ok(JsValue::NULL),
        Err(e) => Err(JsValue::from_str(&e.to_string())),
    }
}

/// Write an envelope (JSON of a DialEnvelope, as dial_parse gives it; `raw` not needed) as DIAL text — what dial_parse
/// reads back to the same envelope.
#[wasm_bindgen]
pub fn dial_serialize(envelope_json: &str) -> Result<String, JsValue> {
    let mut v: serde_json::Value = serde_json::from_str(envelope_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    if let Some(o) = v.as_object_mut() { o.entry("raw").or_insert(serde_json::Value::String(String::new())); }
    let envelope: DialEnvelope = serde_json::from_value(v).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(serialize(&envelope))
}

/// An `until` read: JSON of its Condition — or an error saying why it is not one.
#[wasm_bindgen]
pub fn dial_condition(text: &str) -> Result<String, JsValue> {
    let c = condition(text).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&c).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Return the prose portions of a response — text outside any <dial> block.
#[wasm_bindgen]
pub fn dial_extract_prose(text: &str) -> String {
    extract_prose(text)
}

/// WASM-exposed session context handle.
/// Holds declared context (AI-asserted) and execution results (environment-discovered) — separately.
#[wasm_bindgen]
pub struct DialSession {
    inner: DialSessionContext,
}

#[wasm_bindgen]
impl DialSession {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { inner: DialSessionContext::new() }
    }

    /// Store a declared context value (from <dial-declare>).
    /// key: context-key attribute. value_json: JSON string of the value.
    pub fn declare(&mut self, key: &str, value_json: &str) -> Result<(), JsValue> {
        let value: serde_json::Value = serde_json::from_str(value_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.declare(key.to_string(), value);
        Ok(())
    }

    /// Get all declared context as a JSON string.
    pub fn get_declared(&self) -> Result<String, JsValue> {
        serde_json::to_string(self.inner.get_declared())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Record execution results from a <dial-execute> run.
    /// results_json: JSON array of ExecutionResult objects.
    pub fn record_results(&mut self, results_json: &str) -> Result<(), JsValue> {
        let results: Vec<ExecutionResult> = serde_json::from_str(results_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.record_results(results);
        Ok(())
    }

    /// Get last execution results as a JSON string.
    pub fn get_last_results(&self) -> Result<String, JsValue> {
        serde_json::to_string(self.inner.get_last_results())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }
}
