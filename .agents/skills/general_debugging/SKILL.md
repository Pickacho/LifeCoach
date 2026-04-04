---
name: Systematic Debugging
description: A structured workflow for breaking down complex bugs, tracing logs, and verifying fixes contextually.
---

# Systematic Debugging Workflow

1. **Verify Context**: Never assume the bug. Ask the user for the explicit error message or run tests to reproduce it.
2. **Isolate**: Pinpoint exactly which layer (Network, Database, Component, Logic) the failure occurs.
3. **Minimal Fix**: Implement the change that fixes the issue with the lowest system impact. Refactoring should only be done post-fix, as a separate step.
4. **Verify**: Ensure the proposed solution doesn't introduce regressions.
