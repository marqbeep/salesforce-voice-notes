# Split-Call AI Architecture Design

**Date:** 2026-04-16
**Status:** Approved

---

## Problem

A single AI call handles both simple field extraction (phone, address, dates) and subjective judgment (seller motivation, reason not locked, next step). Using a fast cheap model (Haiku) misclassifies judgment fields on messy input. Using a premium model (Sonnet) for extraction is wasteful. Correctness on judgment fields is the priority.

## Solution

Split into two sequential calls:
- **Call 1 — Haiku:** Extracts structured data deterministically
- **Call 2 — Sonnet:** Receives transcript + Haiku output, infers judgment fields and generates summaries

Sonnet treats Haiku's output as the source of truth. It only uses the transcript to resolve ambiguity and add context for judgment decisions. It does not re-extract data Haiku already extracted.

---

## Field Assignment

| Call | Model | Fields |
|------|-------|--------|
| Haiku | `claude-haiku-4-5-20251001` | `seller_phone`, `property_address`, `opportunity_name`, `next_contact_date`, `last_conversation_date`, `last_offer`, `offer_made_time` |
| Sonnet | `claude-sonnet-4-6` | `am_notes`, `next_step`, `reason_not_locked`, `follow_up_status`, `appointment_set_quality`, `appointment_attendance`, `in_person_appointment_completed` |

---

## Architecture

Single entry point `parseWithAI(source)` orchestrates two internal helpers:

```
parseWithAI(source)
  ├── callHaiku(text)       → returns { seller_phone, property_address, ... }
  └── callSonnet(text, haikuResult) → returns { am_notes, next_step, reason_not_locked, ... }
```

Each helper is responsible for one API call and returns a parsed JSON object. `parseWithAI` fills fields and updates UI state between calls.

---

## Prompts

### Haiku Prompt
```
Extract structured data from this real estate sales note. Return ONLY valid JSON, no markdown.

Keys:
- seller_phone: digits only, no dashes or spaces (e.g. 2145158483), empty string if not mentioned
- property_address: full address as "Street, City, ST, Zip" — always 2-letter state abbreviation
- opportunity_name: seller name or deal name
- next_contact_date: follow-up date (YYYY-MM-DD, today is ${today})
- last_conversation_date: date of this conversation (YYYY-MM-DD, default today)
- last_offer: dollar amount as number only, 0 if unknown
- offer_made_time: when offer was made (YYYY-MM-DDTHH:MM), use today noon if not specified

Use empty string "" for unknown text fields.

Note: "${text}"
```

### Sonnet Prompt
```
You are given a real estate sales transcript and structured data already extracted from it.
Treat the extracted data as accurate. Do NOT re-extract it.
Use the transcript only to resolve ambiguity and add context for your judgment.

Your job is to:
1. Write am_notes — detailed summary of seller situation, motivation, and property condition
2. Write next_step — specific, actionable CRM next step (not generic like "follow up")
3. Classify 5 fields using exactly the allowed values

Extracted data:
${JSON.stringify(haikuResult, null, 2)}

Transcript: "${text}"

Return ONLY valid JSON with exactly these keys:
- am_notes: detailed narrative summary
- next_step: specific next action
- reason_not_locked: must be exactly one of: Not Ready, High Price, Other People Involved
- follow_up_status: must be exactly one of: Hot, Cold (Hot = urgent/motivated, Cold = not ready/hesitant)
- appointment_set_quality: must be exactly one of: Good, Bad
- appointment_attendance: must be exactly one of: Everyone Showed Up, AM Rescheduled, Seller didn't Show Up
- in_person_appointment_completed: must be exactly one of: Yes, No
```

---

## Flow

```
parseWithAI(source)
  1. setS('Extracting fields...', '#ff9f1c')
  2. haikuResult = await callHaiku(text)
  3. Fill 7 extraction fields from haikuResult → uf() each
  4. setS('Analyzing context...', '#ff9f1c')
  5. sonnetResult = await callSonnet(text, haikuResult)
  6. Fill 7 judgment fields from sonnetResult → uf() each
  7. setS('✅ Fields filled from your note!', '#00e5a0')
  8. checkSend()
```

---

## Error Handling

**Haiku fails:**
- Show error in status line: `❌ Parse failed: ${err.message}`
- No fields filled
- Re-parse button re-enabled
- User retries from scratch

**Haiku succeeds, Sonnet fails:**
- 7 extraction fields remain filled (green borders)
- Error banner: `❌ AI analysis failed. Extraction fields filled — please complete the remaining fields manually.`
- Re-parse button re-enabled (user can retry Sonnet by re-parsing)
- Send button stays disabled until judgment fields are manually filled

---

## UI Status Messages

| Phase | Message | Color |
|-------|---------|-------|
| Haiku running | `Extracting fields...` | `#ff9f1c` (orange) |
| Sonnet running | `Analyzing context...` | `#ff9f1c` (orange) |
| Both done | `✅ Fields filled from your note!` | `#00e5a0` (green) |
| Haiku failed | `❌ Parse failed: ${err}` | `#ff4d6d` (red) |
| Sonnet failed | `❌ Analysis failed — complete remaining fields manually` | `#ff4d6d` (red) |

---

## File to Modify

- `index.html` — `parseWithAI()` function (currently ~line 295–390)
  - Replace single API call with two helper functions
  - No other files change

---

## Verification

1. Parse a note with clear extraction data — verify Haiku fields fill correctly after step 3 (before Sonnet runs)
2. Parse a note with ambiguous motivation ("she's interested but waiting on her brother") — verify `reason_not_locked: Other People Involved` and `follow_up_status: Hot`
3. Simulate Sonnet failure (temporarily use a bad model name for the Sonnet call) — verify extraction fields stay filled, error message appears, send button stays disabled
4. Parse a note with a specific timeline ("call her back Thursday after she talks to her realtor") — verify `next_step` reflects this specifically
