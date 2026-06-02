---
name: hpview-license-build
description: Build an authorized HPView/OHIF deployment package for this repository using the project's existing `yarn build:hpview` command. Use when the user needs to generate the `platform/app/hpview` package for a specific hospital query parameter and hostname, generate or use deployment license hashes, prevent plaintext hospital/host values from appearing in the hpview output directory, or verify that an agent/reseller-specific HPView build is locked to one hospital and domain.
---

# HPView License Build

## Purpose

Use this skill to create reseller-specific HPView builds that are locked by:

- URL query hospital value, normally `hospital=...`
- Browser hostname, normally the domain in `http://HOST/hpview/viewer?...`
- A per-reseller salt

The build must not include the plaintext hospital or hostname in `platform/app/hpview`. It should include only salted SHA-256 hashes.

## Workflow

1. Confirm the repository root is the current working directory.
2. Collect these inputs from the user if missing:
   - hospital identifier from the URL, for example `AAA`
   - authorized hostname, for example `BBB` or `viewer.example.local`
   - salt; if missing, generate a long random value and show it to the user
3. Prefer the bundled script:

```powershell
.\.codex\skills\hpview-license-build\scripts\build-hpview-license.ps1 `
  -Hospital "AAA" `
  -HostName "BBB" `
  -Salt "replace-with-random-salt"
```

4. Use `-QuickBuild` only for local verification when full minification fails or is too slow:

```powershell
.\.codex\skills\hpview-license-build\scripts\build-hpview-license.ps1 `
  -Hospital "AAA" `
  -HostName "BBB" `
  -Salt "replace-with-random-salt" `
  -QuickBuild
```

5. Treat a successful script run as the expected deliverable. It produces or updates `platform/app/hpview`.

## Manual Fallback

If the bundled script cannot run, do the same steps manually:

```powershell
$env:OHIF_LICENSE_HOSPITAL_HASHES="<hospital hash>"
$env:OHIF_LICENSE_HOST_HASHES="<host hash>"
$env:OHIF_LICENSE_SALT="<salt>"
$env:OHIF_LICENSE_HOSPITAL_PARAM="hospital"
yarn build:hpview
```

Generate hashes with the project helper:

```powershell
node .scripts/deployment-license-hash.mjs --salt "<salt>" --hospital "AAA" --host "BBB"
```

Use the printed `OHIF_LICENSE_HOSPITAL_HASHES`, `OHIF_LICENSE_HOST_HASHES`, and `OHIF_LICENSE_SALT` values for the build. Prefer hash environment variables over raw `OHIF_LICENSE_HOSPITALS` and `OHIF_LICENSE_HOSTS` when making a distributor package.

## Verification

After building, always check:

```powershell
rg -n --fixed-strings "AAA" platform\app\hpview
rg -n --fixed-strings "BBB" platform\app\hpview
```

No matches should be returned for the actual hospital or hostname. Hash values are expected to appear in the app bundle.

If full production build fails at Terser with Windows exit code `3221226505`, report that minification failed locally and re-run with `-QuickBuild` only to validate license wiring. Do not describe QuickBuild output as the final production package unless the user accepts it.

## Notes

- The runtime check is in `platform/app/src/utils/deploymentLicense.ts`.
- Webpack injection is in `.webpack/webpack.base.js`, used by the existing root command `yarn build:hpview`.
- Rsbuild injection is in `rsbuild.config.ts`, used by the fast dev/build path.
- This is client-side copy protection. For stronger enforcement, the backend/token should also bind `hospital`, `host`, and `studyuid`.
