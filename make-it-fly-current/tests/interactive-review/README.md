# Local interactive review (no persistence)

This fixture exercises the real ProfileForm and PostEditor React components. It calls the real validation actions with test-only module replacements for authentication, persistence and navigation. The database, auth provider and external transports are not bundled. Valid data stops at a throwing persistence boundary; no success path can write, publish, schedule or redirect to a real record.

The browser fetch adapter returns a simulated error without delegating to fetch. The accompanying local preview proxy rejects all non-GET/HEAD requests and supplies `connect-src 'none'; form-action 'none'` on review HTML. These protections are local preview tooling, not production authentication changes.

Build after the normal application build and after generating the static review HTML. Use the required global FIFO queue:

```
/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node tests/interactive-review/build.mjs
```

The builder writes only under `/private/tmp/apogee-design-review`, checks the bundle module list for forbidden real transports, and augments only the `profileedit` and `editor` HTML fixtures. The normal Next routes do not import these files. Review UI actions and event counters are ephemeral and reset on reload. Do not use real member information or personal images in these fixtures.
