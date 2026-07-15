pub(super) fn format_browser_command(exe_path: &str, args: &[String]) -> String {
    std::iter::once(exe_path)
        .chain(args.iter().map(String::as_str))
        .map(quote_command_arg)
        .collect::<Vec<_>>()
        .join(" ")
}

fn quote_command_arg(arg: &str) -> String {
    if !arg.is_empty() && !arg.chars().any(|ch| ch.is_whitespace() || ch == '"') {
        return arg.to_string();
    }

    let mut quoted = String::from("\"");
    let mut backslashes = 0usize;
    for ch in arg.chars() {
        match ch {
            '\\' => backslashes += 1,
            '"' => {
                quoted.extend(std::iter::repeat_n('\\', backslashes * 2 + 1));
                quoted.push('"');
                backslashes = 0;
            }
            _ => {
                quoted.extend(std::iter::repeat_n('\\', backslashes));
                quoted.push(ch);
                backslashes = 0;
            }
        }
    }
    quoted.extend(std::iter::repeat_n('\\', backslashes * 2));
    quoted.push('"');
    quoted
}

fn split_command_line(command: &str) -> Result<Vec<String>, String> {
    let chars = command.chars().collect::<Vec<_>>();
    let mut args = Vec::new();
    let mut index = 0usize;

    while index < chars.len() {
        skip_whitespace(&chars, &mut index);
        if index >= chars.len() {
            break;
        }
        args.push(parse_command_argument(&chars, &mut index)?);
    }

    Ok(args)
}

fn skip_whitespace(chars: &[char], index: &mut usize) {
    while *index < chars.len() && chars[*index].is_whitespace() {
        *index += 1;
    }
}

fn parse_command_argument(chars: &[char], index: &mut usize) -> Result<String, String> {
    let mut arg = String::new();
    let mut in_quotes = false;

    while *index < chars.len() && (in_quotes || !chars[*index].is_whitespace()) {
        let backslashes = take_backslashes(chars, index);
        if consume_quote(chars, index, backslashes, &mut in_quotes, &mut arg) {
            continue;
        }

        arg.extend(std::iter::repeat_n('\\', backslashes));
        if *index < chars.len() {
            arg.push(chars[*index]);
            *index += 1;
        }
    }

    if in_quotes {
        Err("浏览器命令包含未闭合的引号".to_string())
    } else {
        Ok(arg)
    }
}

fn take_backslashes(chars: &[char], index: &mut usize) -> usize {
    let start = *index;
    while *index < chars.len() && chars[*index] == '\\' {
        *index += 1;
    }
    *index - start
}

fn consume_quote(
    chars: &[char],
    index: &mut usize,
    backslashes: usize,
    in_quotes: &mut bool,
    arg: &mut String,
) -> bool {
    if *index >= chars.len() || chars[*index] != '"' {
        return false;
    }

    arg.extend(std::iter::repeat_n('\\', backslashes / 2));
    if backslashes.is_multiple_of(2) {
        *in_quotes = !*in_quotes;
    } else {
        arg.push('"');
    }
    *index += 1;
    true
}

pub(super) fn parse_browser_command(browser_path: &str) -> Result<(String, Vec<String>), String> {
    let browser_path = browser_path.trim();
    if browser_path.is_empty() {
        return Err("浏览器路径为空".to_string());
    }

    if browser_path.starts_with('"') {
        return parse_quoted_browser_command(browser_path);
    }

    if let Some(exe_end) = browser_path.to_ascii_lowercase().find(".exe") {
        return parse_windows_executable_command(browser_path, exe_end + 4);
    }

    parse_path_followed_by_flags(browser_path)
}

fn parse_quoted_browser_command(command: &str) -> Result<(String, Vec<String>), String> {
    let mut parts = split_command_line(command)?;
    if parts.is_empty() {
        return Err("浏览器路径为空".to_string());
    }
    let path = parts.remove(0);
    Ok((path, parts))
}

fn parse_windows_executable_command(
    command: &str,
    exe_end: usize,
) -> Result<(String, Vec<String>), String> {
    let path = command[..exe_end].trim().to_string();
    let remaining = command[exe_end..].trim();
    let args = if remaining.is_empty() {
        Vec::new()
    } else {
        split_command_line(remaining)?
    };
    Ok((path, args))
}

fn parse_path_followed_by_flags(command: &str) -> Result<(String, Vec<String>), String> {
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return Err("浏览器路径为空".to_string());
    }

    let arg_start = parts
        .iter()
        .position(|part| part.starts_with('-'))
        .unwrap_or(parts.len());
    let exe_path = parts[..arg_start].join(" ");
    let args = parts[arg_start..]
        .iter()
        .map(|part| (*part).to_string())
        .collect();

    Ok((exe_path, args))
}

#[cfg(test)]
mod tests {
    use super::{format_browser_command, parse_browser_command};

    #[test]
    fn keeps_unquoted_windows_path_with_spaces() {
        let (path, args) =
            parse_browser_command(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
                .expect("path should parse");

        assert_eq!(
            path,
            r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        );
        assert!(args.is_empty());
    }

    #[test]
    fn splits_flags_after_unquoted_path() {
        let (path, args) = parse_browser_command(
            r"C:\Program Files\Google\Chrome\Application\chrome.exe --incognito --profile-directory=Default",
        )
        .expect("path with args should parse");

        assert_eq!(
            path,
            r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        );
        assert_eq!(args, vec!["--incognito", "--profile-directory=Default"]);
    }

    #[test]
    fn round_trips_quoted_path_and_arguments() {
        let path = r"C:\Program Files\Chromium\browser.exe";
        let args = vec![
            "--profile-directory=Portable User".to_string(),
            r#"--label=Say "hello""#.to_string(),
            "--incognito".to_string(),
        ];
        let command = format_browser_command(path, &args);

        assert_eq!(
            parse_browser_command(&command),
            Ok((path.to_string(), args))
        );
    }

    #[test]
    fn rejects_unclosed_quotes() {
        assert!(parse_browser_command(r#""C:\Browsers\browser.exe --incognito"#).is_err());
    }
}
