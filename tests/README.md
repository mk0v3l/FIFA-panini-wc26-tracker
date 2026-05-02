# Regression tests

Run:

```sh
npm test
```

The regression suite starts a copy of the app in a temporary directory, so it does not read or write the real `data/collection.json`, `data/history.json`, or `data/pending-trades.json`.

Coverage:
- server health and static assets
- card parsing through import/trade APIs
- import, real trade, trade preview
- manual card changes and history
- targeted history revert and conflict handling
- exports
- friend comparison
- pending trades when the routes exist

When adding a future story, add or update tests in `tests/regression.test.js` before committing that story. The test should focus on behavior and API responses rather than fragile HTML/CSS details.
