# Product: Go Roadmap

<!-- impeccable:product-schema 1 -->

App-specific record for `apps/go-roadmap`. Users, positioning, principles, brand voice, and constraints are shared with the other roadmaps and live in the root `PRODUCT.md`. This file holds only what differs.

## Platform

web

## Users

Same as root: a developer who already programs in another language and wants Go's mental model in dependency order. The articles explain what is different about Go (zero values, slices that alias, nil maps, implicit interfaces, goroutines) rather than what a variable is.

## Product Purpose

Teach Go in dependency order, from `package main` to generics and concurrency, with every step compiled and tested by the real Go toolchain from the page.

## Operating Context

- 18 modules, 76 exercises. Stages in graph order: Foundations, Core language, Types and packages, Idiomatic Go, In practice.
- Module labels: What is Go?, Variables & types, Control flow, Functions, Strings & runes, Arrays & slices, Pointers, Maps, Structs & methods, Errors, Interfaces, Packages & modules, Generics, Goroutines & channels, Select, sync & context, Testing, Standard library tour, Practice problems.
- Runtime: the official Go Playground (`play.golang.org/compile`) compiles and runs every Run. Exercises are `package main` without `func main`; `src/runtime.ts` adds a `main` that runs the `Test*` functions through `testing.Main -test.v` and parses the output into per-test results. Monaco with Go highlighting, tabs for indentation.
- The first Run of a session shows "Compiling…"; there is nothing to download. The Playground fakes time (2009-11-10), which the concurrency exercises rely on for deterministic timeouts.
- Live at `https://go-roadmap-pink.vercel.app`, Vercel project `go-roadmap`.

## Capabilities and Constraints

- Needs the network: code runs on the public Go Playground, not in the page. If it is down or rate-limits, Run shows the error. Self-hosting the Playground's sandbox is the upgrade path.
- Standard library only; one package per exercise, so the Packages module teaches layout in prose and exercises naming, init order, and package-level state.
- `npm run verify` checks every playground and starter against the Playground; with `--solutions <dir>` it also checks reference solutions (kept outside the repo).
- Brand mark: white "GO" on Go's dark cyan (#007d9c).

## Evidence on Hand

- 18 articles under `src/content/`, every exercise verified against a reference solution on the live Playground.
- No usage data. Do not invent completion rates or learner counts.
