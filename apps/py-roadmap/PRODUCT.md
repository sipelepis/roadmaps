# Product: Python Roadmap

<!-- impeccable:product-schema 1 -->

App-specific record for `apps/py-roadmap`. Users, purpose, positioning, principles, brand voice, and constraints are shared with the TypeScript app and live in the root `PRODUCT.md`. This file holds only what differs.

## Platform

web

## Users

Same as root. The Python-specific assumption is lighter than the TypeScript app's: the first module explains the REPL, indentation as syntax, and running a file, so a learner coming from any language can start. It still does not explain what a variable is.

## Product Purpose

Teach Python from syntax to idiom in dependency order, ending in practice problems, with every exercise run by real CPython in the page.

## Operating Context

- 20 modules, 19 with a playground, roughly 80 exercises. The site's own counter is authoritative. Stages in graph order: Foundations, Core language, Structure, Idiomatic Python, In practice.
- Module labels: What is Python?, Variables & types, Control flow, Strings, Lists & tuples, Functions, Dicts & sets, Comprehensions, Errors & exceptions, Modules & imports, Classes, Iterators & generators, Files & JSON, Closures & decorators, Dataclasses, Type hints, Standard library tour, Dunder & protocols, Advanced patterns, Practice problems.
- Runtime: Pyodide, CPython compiled to WebAssembly, loaded from the jsDelivr CDN on the first Run of a session. Until it is ready the Run button reads "Loading Python…" and the playground prints the same line. The editor is Monaco with Python syntax highlighting only; there is no in-editor type checking.
- Tests: plain `test_*` functions using `assert`. The function's docstring is the row label. Starter and tests run in one namespace, so tests call the learner's functions directly. A problem passes when the code runs without error and every test passes; a run with zero tests does not pass.
- Standard output is captured and shown as a single "Output" row. An uncaught exception shows as one "Error" row with the traceback.
- Live at `https://py-roadmap-ten.vercel.app`, Vercel project `py-roadmap`.

## Capabilities and Constraints

- First run in a session is slow because Pyodide is several megabytes. The loading state is part of the product and must stay visible, not hidden behind a spinner with no words.
- Requires network access to jsDelivr on first run. Offline use is not supported.
- Brand mark: Python Yellow (#ffd43b) "PY" on Blueprint Blue (#3178c6), echoing the language's two-tone logo.
- Undecided: whether to support `input()` or file-system exercises, and whether to bundle Pyodide locally instead of loading it from the CDN.

## Evidence on Hand

- 20 articles under `src/content/`, each with starter and test blocks.
- No usage data. Do not invent completion rates or learner counts.
