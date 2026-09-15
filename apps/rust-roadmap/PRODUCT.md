# Product: Rust Roadmap

<!-- impeccable:product-schema 1 -->

App-specific record for `apps/rust-roadmap`. Users, positioning, principles, brand voice, and constraints are shared with the other roadmaps and live in the root `PRODUCT.md`. This file holds only what differs.

## Platform

web

## Users

Same as root: a developer who already programs in another language and wants Rust's mental model in dependency order. The articles spend their time on what the compiler rejects and why (moves, borrows, lifetimes), showing the real error you would hit.

## Product Purpose

Teach Rust in dependency order, from `fn main` through ownership and borrowing to traits, iterators, smart pointers, and threads, with every step compiled and tested by the real toolchain from the page.

## Operating Context

- 20 modules, 85 exercises. Stages in graph order: Foundations, Core language, Ownership, Data and types, Abstraction, Advanced Rust, In practice.
- Module labels: What is Rust?, Variables & types, Control flow, Functions, Ownership, Borrowing & references, Strings & slices, Structs & methods, Vec & HashMap, Enums & match, Modules & crates, Option & Result, Traits, Error handling, Generics & bounds, Closures & iterators, Lifetimes, Box, Rc & RefCell, Threads & channels, Practice problems.
- Runtime: the official Rust Playground (`play.rust-lang.org/execute`, stable, edition 2024) compiles and runs every Run. Exercises compile as a library; `src/runtime.ts` wraps the `#[test]` functions in `mod tests { use super::*; }`, runs `cargo test`, and parses the output into per-test results. `assert_eq!(actual, expected)` feeds the expected-vs-actual panel. Compile errors show rustc's own diagnostics.
- Live at `https://rust-roadmap-two.vercel.app`, Vercel project `rust-roadmap`.

## Capabilities and Constraints

- Needs the network: code runs on the public Rust Playground, not in the page. A compile plus test run takes a few seconds. Self-hosting rust-playground is the upgrade path.
- Standard library only. The Playground ships popular crates as externs, so a local module named like one (`time`, `rand`, `regex`, `log`) is ambiguous in tests; avoid those names.
- `npm run verify` checks every playground and starter against the Playground; with `--solutions <dir>` it also checks reference solutions (kept outside the repo).
- Brand mark: white "RS" on rust orange (#b7410e).

## Evidence on Hand

- 20 articles under `src/content/`, every exercise verified against a reference solution on the live Playground, and every article code block checked to compile (or to fail with the error code it claims).
- No usage data. Do not invent completion rates or learner counts.
