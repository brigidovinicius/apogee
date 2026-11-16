// Run through npm-queue; no production dotenv, API or database is used.
process.env.APOGEE_BENEFITS_REVIEW = '1';
process.env.APOGEE_REVIEW_INSTANCE ??= 'benefits-workspace';
process.env.APOGEE_REVIEW_PORT ??= '3486';
await import('./local-offer-review.mjs');
