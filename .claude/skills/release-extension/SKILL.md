---
name: release-extension
description: Build and release the Steam Add Funds Helper browser extension. Use when the user wants to package the extension, bump the version, create a release zip, or cut a release tag. Mirrors exactly what .github/workflows/deploy.yml ships to the Chrome Web Store and Edge Add-ons.
---

# Releasing the extension

The CI pipeline in `.github/workflows/deploy.yml` deploys on push to `main` (upload only) and **publishes** when a `v*` tag is pushed. This skill produces a build identical to CI and drives the version/tag flow.

## Source of truth: the build

The extension is TypeScript (`src/`) bundled by esbuild. `pnpm run build:zip` (used by both you and CI) runs `scripts/build.mjs` to produce `dist/` and then zips its contents:

- `dist/content.js` — `src/content.ts` + `src/currency.ts` bundled into one IIFE
- `dist/manifest.json`, `dist/styles.css`, `dist/_locales/` — copied as-is (`.DS_Store` filtered out)

`dist/` is git-ignored and rebuilt every time. Only files that `scripts/build.mjs` emits or copies into `dist/` ship. When you add a new runtime asset, update `scripts/build.mjs` to copy it — otherwise it silently won't be included.

## Steps

### 1. Pre-flight

- Confirm the working tree is clean (`git status`).
- Run `pnpm run check` (lint + format + tests) — the same gate CI enforces before deploy.
- Run the `extension-reviewer` agent on the current state if there are recent source changes.
- Confirm every required locale file exists: `_locales/{ko,en,ja,zh_CN}/messages.json`.

### 2. Bump the version

- Edit `version` in `manifest.json` (semver). Patch for fixes, minor for new behavior. This is the single source of the published version number.
- Match the git tag to it: `manifest.json` `0.3.2` → tag `v0.3.2`.

### 3. Build locally (to verify)

```
pnpm run build:zip
unzip -l extension.zip   # confirm contents match the source list, no extras (no .DS_Store, dist.zip, image.png, README)
```

Note: `dist.zip`, `image.png`, and docs are intentionally excluded — never add them to the zip.

### 4. Commit, tag, push

```
git add manifest.json   # + any source changes
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```

Only push the tag when you intend to **publish** — pushing to `main` without a tag uploads a draft but does not publish (`publish:` is gated on `refs/tags/`).

### 5. Confirm

- Report the GitHub Actions run URL (`gh run list --workflow=deploy.yml`) and watch it (`gh run watch`).

## Guardrails

- Do not push tags unless the user explicitly asks to publish — tagging triggers a live store submission.
- Never commit `extension.zip` / `dist.zip` (they're build artifacts; check `.gitignore`).
