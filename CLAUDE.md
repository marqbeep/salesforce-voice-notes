# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file HTML app (`index.html`) — no build system, no dependencies, no package manager. Open directly in a browser.

## Architecture

Everything lives in `index.html`:

- **CSS** (lines 7–61): Dark theme UI with a green (`#00e5a0`) / purple (`#7b5ea7`) / red (`#ff4d6d`) color system.
- **HTML** (lines 63–208): Layout split into: header → API key input → Zapier webhook input → voice/manual note area → Salesforce fields → send button.
- **JavaScript** (lines 209–438): No frameworks. Key functions:
  - `parseWithAI(source)` — calls Anthropic API (`/v1/messages`) directly from the browser using `anthropic-dangerous-direct-browser-access: true` header. Model: `claude-opus-4-6`. Returns JSON that maps directly to field IDs.
  - `sendToZapier()` — POSTs structured payload to user-supplied Zapier webhook URL using `mode: 'no-cors'` (response is opaque; success is assumed).
  - `uf(k)` — updates field visual state (filled/missing) and triggers `checkSend()`.
  - `toggleRecord()` / `startRec()` / `stopRec()` — Web Speech API wrapper (`window.SpeechRecognition`). Chrome only.

## Field System

Fields are divided into three categories defined in the JS:
- **Search fields** (`seller_phone`, `property_address`, `opportunity_name`) — used by Zapier to locate the Salesforce record.
- **Required fields** — listed in the `REQ` array (line 210); all must be filled before the send button enables.
- **Locked/auto fields** — hardcoded values (`stage: 'Follow Up'`, `am_to_make_last_offer: 'Marquis Figueroa'`, `survey_call_assigned_to: 'Marcus Daniel'`); not editable by the user.

## Zapier Payload

The exact keys sent in `sendToZapier()` (lines 374–394) must match what the Zapier Zap expects. Changing field names here requires a corresponding update in Zapier.

## Git & GitHub

- Repo: https://github.com/marqbeep/salesforce-voice-notes (private)
- Always commit and push after changes with a descriptive message.
