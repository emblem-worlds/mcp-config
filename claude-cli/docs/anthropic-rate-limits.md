# Anthropic API Rate Limits

## Overview
- Daily token limit: 1,000,000 tokens per day
- Error code: 429
- Error type: rate_limit_error

## Detailed Information
When an organization exceeds its daily token limit of 1,000,000 tokens, the API will return a 429 error.

## Recommended Actions
1. Reduce prompt length
2. Reduce maximum tokens requested
3. Wait and retry later
4. Contact sales to discuss options for rate limit increase

## Contact Information
- Sales URL: https://www.anthropic.com/contact-sales

## Additional Notes
- Check response headers for current usage
- Rate limits are applied at the organization level
