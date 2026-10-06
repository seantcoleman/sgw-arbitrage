## Summary

<!-- What changed and why -->

## Claim accuracy (required for marketing / pricing / SEO copy)

When this PR touches prices, fees, features, or public claims, check:

- [ ] `frontend/src/lib/seo.ts` constants (`STANDARD_SUCCESS_FEE_PCT`, `PRO_MONTHLY_USD`) match Stripe / product reality
- [ ] Home + Pricing UI and JSON-LD Offers match those constants
- [ ] `frontend/public/llms.txt` updated
- [ ] Compare / alternatives tables still accurate (or dated + caveated)
- [ ] FAQ answers that mention fees/prices updated

## SEO / content

- [ ] New URLs registered in `frontend/src/lib/guides.ts` (sitemap)
- [ ] Unique title, description, canonical
- [ ] Internal links from hub / related guides

## Test plan

- [ ] 
