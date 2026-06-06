---
name: add-locale
description: Add a new language/locale to the Steam Add Funds Helper extension, or audit existing locales for missing/extra message keys. Use when the user wants to support a new language, translate the UI, or verify i18n consistency across _locales.
---

# Adding or auditing a locale

The extension localizes via the Chrome i18n API (`chrome.i18n.getMessage`). Each language is a folder under `_locales/<code>/messages.json`. `default_locale` in `manifest.json` is `ko`.

## Required message keys

Every locale file MUST contain exactly these keys (and only these):

| Key                 | Used in                | Has placeholder   |
| ------------------- | ---------------------- | ----------------- |
| `extName`           | manifest `name`        | no                |
| `extDescription`    | manifest `description` | no                |
| `title`             | card heading           | no                |
| `buttonText`        | submit button          | no                |
| `minAmountText`     | helper text            | `$AMOUNT$` (`$1`) |
| `inputError`        | validation error       | `$AMOUNT$` (`$1`) |
| `formNotFoundError` | submit failure         | no                |

> Add a key only when `src/` actually calls `getMessage` for it — unused keys are dead weight and the `extension-reviewer` agent flags them.

## Adding a new locale

1. Pick the Chrome locale code (e.g. `de`, `fr`, `es`, `zh_TW`, `pt_BR`). See https://developer.chrome.com/docs/extensions/reference/api/i18n#locales.
2. Copy `_locales/en/messages.json` as the template into `_locales/<code>/messages.json`.
3. Translate every `message` value. Keep `$AMOUNT$` placeholders and the `placeholders` blocks **byte-for-byte** — translate only surrounding text. For currency-formatted amounts, do not add a currency symbol in the string; `Intl.NumberFormat` injects it at runtime.
4. Keep key names and JSON structure identical to the template.
5. The build (`scripts/build.mjs`) copies the whole `_locales/` tree into `dist/`, so no build or `deploy.yml` change is needed for a new language file.

## Auditing consistency

To verify all locales agree, diff the key sets:

```
for f in _locales/*/messages.json; do echo "== $f"; jq -r 'keys[]' "$f" | sort; done
```

Report: keys missing from any locale, keys present in some but not all, and any key in locales that is never referenced in source (`grep -rn "getMessage('<key>'" src/`).

## After changes

- Validate each JSON file parses (`jq . _locales/<code>/messages.json`).
- Run the `extension-reviewer` agent's i18n check.
