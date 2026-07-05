---
defaultModel: openai/gpt-5.4-mini
fallbackModel: openai/gpt-5.4-mini
models:
  - anthropic/claude-sonnet-4.6
  - anthropic/claude-haiku-4.5
  - deepseek/deepseek-v4-flash
  - deepseek/deepseek-v4-pro
  - moonshotai/kimi-k2.6
  - openai/gpt-5.4-mini
  - openai/gpt-5.4
recipes:
  finance-sync:
    enabled: false
    model: openai/gpt-5.4-mini
    fallback: deepseek/deepseek-v4-flash
  project-sync:
    enabled: false
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
---

<!-- Engine model config — edited via the recipes UI; safe to hand-edit. -->
