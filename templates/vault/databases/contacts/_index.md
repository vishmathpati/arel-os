---
type: database
name: Contacts
description: People and companies — a standalone database (no area).
columns:
  - key: company
    label: Company
    type: text
    icon: lucide:Star
    icon_color: blue
    width: 270
  - key: email
    label: Email
    type: email
  - key: phone
    label: Phone
    type: phone
  - key: website
    label: Website
    type: url
  - key: tags
    label: Tags
    type: multi_select
    options:
      - Lead
      - Customer
      - Partner
      - VIP
    option_colors:
      VIP: gray
      Lead: blue
  - key: stage
    label: Stage
    type: status
    groups:
      - label: To-do
        options:
          - Not started
      - label: In progress
        options:
          - In progress
      - label: Complete
        options:
          - Done
  - key: owner
    label: Owner
    type: relation
  - key: attachments
    label: Files
    type: files
  - key: created
    label: Added
    type: created
  - key: priority
    label: Priority
    type: select
    options: []
    hidden: true
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
---
