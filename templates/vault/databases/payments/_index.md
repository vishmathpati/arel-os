---
type: database
name: Payments
area: "[[finance]]"
description: One row per actual charge. Linked to the Subscription it came from.
columns:
  - key: subscription
    label: Subscription
    type: relation
    relation_target: subscriptions
    relation_multiple: false
    width: 388
  - key: date
    label: Date
    type: date
    width: 316
  - key: amount
    label: Amount (₹)
    type: number
    number_format: inr
  - key: period
    label: Period
    type: text
    width: 100
  - key: source
    label: Source / reference
    type: text
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
full_width: true
---
