---
type: database
name: Transactions
area: "[[finance]]"
description: Income and expense ledger, extracted from email twice daily.
columns:
  - key: date
    label: Date
    type: date
    hidden: false
  - key: amount
    label: Amount
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
  - key: amount_inr
    label: Amount (₹)
    type: number
    hidden: false
  - key: type
    label: Type
    type: select
    options:
      - Income
      - Expense
      - Transfer
    hidden: false
  - key: category
    label: Category
    type: select
    options:
      - Food
      - Transport
      - Shopping
      - Utilities
      - Bills
      - Health
      - Fitness
      - Salary
      - Investment
      - Subscription
      - Credit Card Payment
      - EMI
      - Dev
      - AI
      - Media
      - Design
      - Card Admin
      - Transfer
      - Other
    hidden: false
  - key: account
    label: Account
    type: relation
    hidden: false
  - key: method
    label: Method
    type: select
    options:
      - UPI
      - Card
      - Bank transfer
      - Cash
      - EMI
      - AutoPay
      - Refund
      - Online banking
    hidden: false
  - key: merchant
    label: Merchant
    type: text
    hidden: false
  - key: subscription
    label: Subscription
    type: relation
    hidden: false
  - key: status
    label: Status
    type: select
    options:
      - Cleared
      - Pending
    hidden: false
  - key: source
    label: Source
    type: text
    hidden: false
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
full_width: true
---
