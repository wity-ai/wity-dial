use thiserror::Error;

#[derive(Debug, Error)]
pub enum DialError {
    #[error("Parse error: {0}")]
    Parse(String),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}
