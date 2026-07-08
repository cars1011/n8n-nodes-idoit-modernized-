# n8n-nodes-idoit (modernized)

n8n community node for reading and writing [i-doit](https://www.i-doit.com/) CMDB data via its JSON-RPC API.

This is a modernized rewrite of the original node by Christian Vojak
(https://github.com/ilsuky/n8n-nodes-idoit, last published 2022).

## What changed vs. the original

**Correctness**
- Fixed a real bug in `cmdb.objects` filtering: the category filter used to be
  built as a literal, non-interpolated string (`` ['`${category}`'] ``)
  instead of the actual selected category value.
- JSON-RPC level errors (i-doit returns HTTP 200 with an `error` object in the
  body) are now detected and surfaced as proper node errors instead of being
  silently returned as "successful" output.
- Per-item error handling now correctly reports the failing item index
  (`itemIndex`) instead of always pointing at item 0.

**API/tech debt**
- Replaced the deprecated `request`/`request-promise-native` library with
  n8n's built-in `this.helpers.httpRequest`, which is what current n8n
  versions expect (the old library was removed from n8n's runtime).
- Replaced the string literals `'main'` for inputs/outputs with
  `NodeConnectionTypes.Main`, matching current n8n-workflow typings.
- Removed the hardcoded `rejectUnauthorized: false` (meaning every install
  silently skipped SSL verification). This is now an explicit, opt-in
  credential toggle ("Ignore SSL Certificate Errors").
- Added a working credential test (calls `idoit.version`) so you can validate
  a connection directly from the credential screen.
- Removed `@ts-ignore` workarounds and the no-longer-existing `INodeParameters`
  type; everything now compiles cleanly under `strict` TypeScript.
- Added `usableAsTool: true` so the node can be used as a tool by AI Agent
  nodes.

**Performance**
- Added optional session-based authentication: if you configure a dedicated
  API user (username/password) on the credentials, the node now logs in once
  per workflow execution (`idoit.login`) and reuses the session for every
  item, instead of re-authenticating on every single API call. i-doit's own
  documentation recommends this for anything beyond a handful of requests, to
  avoid piling up unclosed sessions. The session is closed (`idoit.logout`)
  when the node finishes, even if an error occurred.

**Maintainability**
- Consolidated ~1100 lines of heavily duplicated `if` branches in `execute()`
  into one dispatch per resource, each calling a single shared
  `idoitApiRequest()` helper.
- Renamed `namespace` → `resource` / kept `operation`, matching current n8n
  node UI conventions (e.g. `cmdb.object` → `cmdbObject`).
- Updated `package.json`/`tsconfig.json` to current tooling (TypeScript 5,
  ESLint 8 with the current `eslint-plugin-n8n-nodes-base` ruleset, pinned
  `n8n-workflow` version instead of `"*"`).

## Breaking changes if you're migrating from the original node

- **Credential type renamed**: `idoit` → `idoitApi`. You'll need to
  re-create the credential (host + API key transfer over, but you'll also
  see the new optional username/password/SSL fields).
- **Resource/operation values renamed** (e.g. `cmdb.object` is now
  `cmdbObject`). Existing workflows built on the old node will need their
  Resource/Operation dropdowns re-selected.
- The `color` field in node defaults was dropped (deprecated by n8n; node
  color is now derived from the icon/theme automatically).

## Setup

1. `npm install`
2. `npm run build`
3. Install the resulting package as a community node in your n8n instance
   (Settings → Community Nodes → install from local path, or publish to npm
   and install by package name), or copy `dist/` into
   `~/.n8n/custom/n8n-nodes-idoit`.

## Credentials

- **Host**: base URL of your i-doit instance, e.g. `https://demo.i-doit.com`
  (no trailing slash, no `/src/jsonrpc.php` - the node appends that itself).
- **API Key**: from Administration → Add-ons → JSON-RPC API in i-doit.
- **Use Dedicated API User** (optional): enable to authenticate with a
  specific i-doit user account instead of the built-in "Api System" user, and
  to get the session-reuse performance benefit described above.
- **Ignore SSL Certificate Errors**: only enable for trusted internal
  instances with self-signed certificates.
