# Local DEP-03 hardening

Upstream braces 3.0.3, MIT; original LICENSE retained. This is not a published upstream fix.
Source: https://registry.npmjs.org/braces/-/braces-3.0.3.tgz
Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

Parser and compile/expand/stringify walkers enforce a fixed 128-level depth limit.
Common patterns are unchanged; overly deep input throws SyntaxError with code BRACES_DEPTH_LIMIT.
This bounds the reported recursion issue, not all possible regex or expansion resource usage.
Dependencies and upstream version are preserved; package metadata omits upstream development tools.
Review the patch and replace this copy when a suitable upstream fix is published.
See docs/braces-security-dep03.md at the repository root for validation and limitations.
