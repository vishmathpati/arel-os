---
type: database
name: Bank accounts
area: "[[finance]]"
description: Bank accounts — where real balance lives. Seeded once, then maintained.
columns:
  - key: bank
    label: Bank
    type: select
    options:
      - Chase
      - Bank of America
      - HSBC
      - HDFC
      - ICICI
      - Other
  - key: type
    label: Type
    type: select
    options:
      - Savings
      - Current
  - key: last4
    label: Last 4
    type: text
    width: 90
  - key: balance
    label: Balance
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
          - Closed
  - key: last-edited-time
    label: Last edited time
    type: updated
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
full_width: true
---
