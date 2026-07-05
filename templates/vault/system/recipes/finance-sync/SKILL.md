---
name: finance-sync
description: Read finance emails (bank alerts, UPI, card statements, subscription receipts) via the gws Gmail CLI and keep the four finance databases — subscriptions, cards, bank-accounts, transactions — in sync. Use this for any "sync my finances from email", "update subscriptions/transactions from Gmail", scheduled finance ingestion, or one-time historical backfill. Runs on a schedule (10:00 + 22:00) and on demand. It reconciles against what already exists — adding new rows, cancelling subscriptions when a cancellation email arrives, and updating balances — rather than blindly re-importing.
allowed-tools: gws, gmail-message, vault-index, web-fetch, vault-read, vault-list, vault-write
trigger: scheduled
schedule: "0 10,22 * * *"
model: anthropic/claude-haiku-4.5
---

# finance-sync

Keep the vault owner's finance databases current from their Gmail. The databases ARE the source of truth; email is the feed. Your prime directive is **idempotent reconciliation**: never create a duplicate, never double-count a charge, and when an email describes a change to something that already exists (a cancellation, a price change, a payment), *update that row* instead of adding a new one.

This matters because you run twice a day on overlapping windows — the 22:00 run will re-see emails the 10:00 run already processed. The only thing standing between that and a corrupted ledger is disciplined deduplication. Treat the Gmail message id as the unique key for every transaction.

## The four databases (all under `databases/`, one markdown file per row)

| Database | Path | Row = | Dedup / match key |
|---|---|---|---|
| Subscriptions | `databases/subscriptions/` | a recurring service | `vendor` (e.g. `openai`) |
| Cards | `databases/cards/` | one credit/debit card | `last4` |
| Bank accounts | `databases/bank-accounts/` | one bank account | `last4` |
| Transactions | `databases/transactions/` | one income/expense event | `source` (Gmail msg id) |

The `_index.md` in each folder defines the columns — read it if unsure of valid select options. Never edit `_index.md`.

## Modes

The task input may say `backfill` or `daily` (default to `daily` if unspecified).

- **`daily`** — incremental. Window = the `after:<epoch>` filter the Engine gives you in the run context (1 hour before the last successful run). Writes transactions, reconciles subscriptions, **and updates balances**.
- **`backfill`** — one-time history load. Window = `after:<BACKFILL_CUTOFF_DATE>`, where `<BACKFILL_CUTOFF_DATE>` is a configurable parameter (e.g. `2026/01/01`) set per-vault before the first run. Writes transactions and subscriptions as an archive but **does NOT touch any balance or `outstanding`** — historical events predate the seeded balances, so applying them would corrupt the starting point. (Backfill of subscriptions should only be re-run once already run, if explicitly asked.)

> **Token discipline (important).** Each run should cost as little as possible. That means: only scan the incremental window (not 2 days); read email bodies with `gmail-message` (clean text), never raw `gws … messages get` (bloated HTML); and reconcile with `vault-index` (names/keys only), reading a full row with `vault-read` ONLY when an email matches one and you need to update it.

## Steps

### 1. Establish mode and date window
Read the task input. If it says `backfill`, use `after:<BACKFILL_CUTOFF_DATE>` (the configured cutoff parameter). Otherwise (daily): **use the `after:<epoch>` window the Engine provided in your run context** — that is the incremental window. If, and only if, no window was provided, fall back to `newer_than:2d`. Note whether balance updates are allowed (daily only).

### 2. Fetch candidate finance emails

#### Your bank senders
This recipe needs to know which email addresses your banks and card providers send alerts from. **Fill these in before the first run** — the two entries below are generic placeholders, not real senders:

```
{{BANK_SENDERS}}
# Example (replace with your own banks' alert addresses):
#   from:alerts@yourbank.example.com
#   from:statements@yourcardprovider.example.com
```

First, list candidate message IDs with a focused search (this returns IDs only — cheap). Use `<WINDOW>` from step 1 and your filled-in `{{BANK_SENDERS}}` list:

```
gws gmail users messages list --page-all --params '{"userId":"me","q":"<WINDOW> ({{BANK_SENDERS}} OR subject:(debited OR credited OR \"UPI\" OR \"transaction alert\" OR statement OR invoice OR receipt OR \"payment\" OR subscription OR renewal OR \"auto-debit\" OR e-mandate OR declined OR cancelled))"}'
```

Then, for each id you still need (after the dedup check in step 3), read it with **`gmail-message id=<ID>`** — it returns clean `{ from, subject, date, body }` as plain text. **Do NOT use `gws … messages get`** — that returns bloated HTML and wastes tokens. Extract the structured facts (amount, currency, date, card/account last4, merchant, direction) from the clean body.

### 3. Load existing state cheaply (so you can reconcile, not duplicate)
Build a compact reconciliation index with **`vault-index`** — never read whole rows just to scan them:
- `vault-index dir='databases/transactions' fields=['source']` → existing Gmail msg-ids. **Skip any email whose id is already here** (don't even `gmail-message` it).
- `vault-index dir='databases/subscriptions' fields=['title','vendor','status']` → subscription index. When an email matches a `vendor`, `vault-read` *that one* subscription's full row to compare/update it.
- `vault-index dir='databases/cards' fields=['title','last4']` and `vault-index dir='databases/bank-accounts' fields=['title','last4']` → `last4 → slug` map for linking and balance updates.

### 4. Classify each new email and act

**Charge / debit / receipt** → create a Transactions row (`type: Expense`).
- Match `last4` to a card or bank account → set `account` to that `[[slug]]`.
- If `daily`: a **debit-card / UPI / bank** debit decrements that bank account's `balance`; a **credit-card** charge increments that card's `outstanding`.
- If the merchant matches an active subscription's `vendor`, also set `subscription: "[[slug]]"`.

**Credit / income** → Transactions row (`type: Income`); if `daily`, increment the bank account `balance`.

**New subscription** (first receipt / trial start / e-mandate) → check the subscription index for that `vendor`. If absent, create a Subscriptions row. If present and active, update its `cost` / `next_renewal` instead of creating a duplicate.

**Cancellation** ("cancelled", "subscription ended", "auto-renew turned off", "we're sorry to see you go") → find the active subscription whose `vendor` matches → set `status: Cancelled` and `cancelled_on: <date>`. Do not create a row. This is the single most valuable reconciliation — a cancel email must close the loop on the existing subscription.

**Payment failed / past due / access paused** → set the matching subscription's `status` to `Payment failed` or `Past due`.

**Card / account statement** → update that card's `outstanding`, `statement_day`, `due_day` (these come from the statement, more authoritative than per-charge math).

**New card or account seen** (a `last4` not in the DB) → create the row (`kind`, `last4`, `currency`, `status: Active`; link a debit card to its bank account via `bank_account` when the email makes it clear).

### 5. Normalize currency
Every money row stores the native `amount`/`cost` + `currency`, AND a normalized value in the vault owner's home currency (`amount_inr` / `cost_inr` — rename per-vault to match the home currency if it isn't INR) so totals work in one unit. For any non-home-currency amount, fetch the rate once per run with the `web-fetch` tool and reuse it:
```
web-fetch  url=https://api.frankfurter.dev/v1/latest?base=USD&symbols=<HOME_CURRENCY>
```
`amount_inr = round(amount * rate, 2)` (for the home currency itself, it equals the amount).

> Tooling note: `gws` and `web-fetch` are Engine tools. Call `gws` with an args list — e.g. `gws args=["gmail","users","messages","list","--params","{…}"]` — the command lines shown above map directly to that list.

### 6. Write rows with vault-write (exact frontmatter)

Transactions — filename is the Gmail message id (`databases/transactions/<msgid>.md`), which guarantees dedup:
```yaml
type: page
title: "<short description>"
database: "[[transactions]]"
date: "YYYY-MM-DD"
amount: <number>
currency: "USD"            # or EUR | GBP | INR
amount_inr: <number>
type: "Expense"            # Income | Expense | Transfer
category: "<valid option>"
account: "[[<card-or-account-slug>]]"
method: "UPI"              # UPI | Card | Bank transfer | Cash | EMI | AutoPay | Refund | Online banking
merchant: "<who>"
subscription: "[[<sub-slug>]]"   # only if it's a subscription charge
status: "Cleared"          # Cleared | Pending
source: "<msgid>"
```

Subscriptions — `databases/subscriptions/<vendor-or-name-slug>.md`:
```yaml
type: page
title: "<service name>"
database: "[[subscriptions]]"
vendor: "<normalized token>"
cost: <number>
currency: "USD"
cost_inr: <number>
cycle: "Monthly"           # Monthly | Yearly | Quarterly | Weekly | Usage | One-time | Recurring
status: "Active"           # Active | Trial | Past due | Payment failed | Paused | Cancelled | Expired
next_renewal: "YYYY-MM-DD"
started: "YYYY-MM-DD"
cancelled_on: "YYYY-MM-DD" # only when cancelled
pays_with: "[[<card-slug>]]"
category: "AI"             # AI | Dev | Design | Media | Productivity | Other
source: "<msgid>"
```

When updating an existing row, read it first, change only the fields the email justifies, and keep the rest. Cards and bank-accounts follow their `_index.md` columns the same way.

### 7. Log the run (always — this is how failures get debugged)
Append exactly one line to `log.md` in this recipe's folder:
```
[YYYY-MM-DD HH:MM] ok      · trigger=<launchd|ui|chat> · model=<slug> · <duration> · <tokens> · <N txns, M subs added, K reconciled>
```
On failure, log `FAILED` with the error text (e.g. `gws auth 401`, `frankfurter timeout`) and what was written before it broke. A bare "ok/failed" with no counts or error is not debuggable — be specific.

## Guardrails worth holding onto
- **Read before you write.** A cancellation, price change, or statement modifies an existing row — fetch it, don't recreate it.
- **The Gmail id is sacred.** It's the transaction filename and the dedup key. If a file with that id exists, the email is already handled.
- **Backfill never moves money.** Balances and `outstanding` are only touched in `daily` mode, for events on/after the seeded starting balance.
- **Don't invent.** If a field isn't in the email, leave it blank. A missing `merchant` is fine; a guessed one corrupts the ledger.
