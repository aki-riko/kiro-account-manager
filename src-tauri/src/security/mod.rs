use keyring::Entry;

const SERVICE_NAME: &str = "KiroAccountManager";

pub fn store_token(account_id: &str, token_type: &str, token: &str) -> Result<(), String> {
    let key = format!("{}_{}", account_id, token_type);
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry.set_password(token)
        .map_err(|e| format!("Failed to store token: {}", e))
}

pub fn get_token(account_id: &str, token_type: &str) -> Result<String, String> {
    let key = format!("{}_{}", account_id, token_type);
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry.get_password()
        .map_err(|e| format!("Failed to retrieve token: {}", e))
}

pub fn delete_token(account_id: &str, token_type: &str) -> Result<(), String> {
    let key = format!("{}_{}", account_id, token_type);
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry.delete_credential()
        .map_err(|e| format!("Failed to delete token: {}", e))
}
