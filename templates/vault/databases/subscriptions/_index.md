---
type: database
name: Subscriptions
area: "[[finance]]"
description: Recurring software and service subscriptions, tracked from email.
columns:
  - key: vendor
    label: Vendor
    type: text
    width: 160
    hidden: false
  - key: cost
    label: Cost
    type: number
    hidden: false
  - key: currency
    label: Currency
    type: select
    options:
      - USD
      - EUR
      - GBP
      - INR
    hidden: false
  - key: cost_inr
    label: Cost (₹/mo)
    type: number
    hidden: false
  - key: cycle
    label: Cycle
    type: select
    options:
      - Monthly
      - Yearly
      - Quarterly
      - Weekly
      - Usage
      - One-time
      - Recurring
    hidden: false
  - key: status
    label: Status
    type: status
    groups:
      - label: Active
        options:
          - Active
          - Trial
      - label: Needs attention
        options:
          - Past due
          - Payment failed
          - Paused
      - label: Ended
        options:
          - Cancelled
          - Expired
    option_colors:
      Active: green
      Expired: red
    hidden: false
  - key: next_renewal
    label: Renews
    type: date
    hidden: false
  - key: started
    label: Started
    type: date
    hidden: false
  - key: cancelled_on
    label: Cancelled
    type: date
    hidden: false
  - key: pays_with
    label: Pays with
    type: relation
    relation_target: cards
    relation_multiple: false
    hidden: false
  - key: category
    label: Category
    type: select
    options:
      - AI
      - Dev
      - Design
      - Media
      - Productivity
      - Other
    hidden: false
  - key: source
    label: Source
    type: text
    hidden: false
  - key: created-time
    label: Created time
    type: created
    hidden: false
  - key: last-edited-time
    label: Last edited time
    type: updated
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
full_width: true
---
