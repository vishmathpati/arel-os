---
type: database
name: Cards
area: "[[finance]]"
description: Credit and debit cards. Each card links to a bank account.
columns:
  - key: kind
    label: Kind
    type: select
    options:
      - Credit
      - Debit
  - key: bank_account
    label: Bank account
    type: relation
    relation_target: bank-accounts
    relation_multiple: false
  - key: network
    label: Network
    type: select
    options:
      - Visa
      - Mastercard
      - RuPay
      - Amex
  - key: last4
    label: Last 4
    type: text
    width: 90
  - key: credit_limit
    label: Limit
    type: number
  - key: outstanding
    label: Outstanding
    type: number
  - key: statement_day
    label: Statement day
    type: number
  - key: due_day
    label: Due day
    type: number
  - key: currency
    label: Currency
    type: select
    options:
      - USD
      - EUR
      - GBP
      - INR
  - key: status
    label: Status
    type: status
    groups:
      - label: Active
        options:
          - Active
      - label: Inactive
        options:
          - Blocked
          - Closed
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
full_width: true
---
