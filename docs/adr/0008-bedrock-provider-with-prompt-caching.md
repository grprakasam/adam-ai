# 0008 - Amazon Bedrock provider with optional prompt caching

* Status: Accepted (2026-10-23)

## Context
Many pharma organisations require models to run inside their cloud account with
IAM-based access and no API keys in config files.

## Decision
Add `BedrockProvider` to `llm_integration` using the model-agnostic Converse API.
Credentials come from the AWS credential chain. Optional `BEDROCK_PROMPT_CACHING`
adds a cache point after the system prompt; cache read/write tokens are reported
and priced separately. Enabled with `BEDROCK_ENABLED=true`.

## Consequences
* Claude (and other Bedrock models) can be used under the customer's account.
* Caching only applies above the model's minimum prefix length (about 1,024 tokens
  for Claude); it pays off when long CDISC rule context is resent.
* Bedrock regional endpoints may carry a price premium over global ones.
