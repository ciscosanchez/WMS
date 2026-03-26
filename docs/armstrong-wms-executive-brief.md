# Armstrong WMS Executive Brief

Date: 2026-03-26

## Purpose

This is the leadership version of the side-by-side review of:

- `docs/WMS-Presentation Nov2024 v2.pptx`
- `docs/Metafields Kick Off Call.pdf`

## Executive Take

Ramola WMS compares well against the original reasons Armstrong wanted to replace Magaya.

On the original 2024 decision criteria, the current product is already strong in the areas that mattered most:

- multi-UOM product support
- customer portal
- rate shopping and carrier flexibility
- EDI / API / marketplace integrations
- reporting and exports
- ASN receiving
- cycle counting
- broader warehouse execution workflows

In several areas, Ramola WMS is already beyond the original ask:

- multi-tenant platform administration
- stronger RBAC and persona separation
- built-in 3PL billing
- yard & dock operations
- labor management
- returns / RMA
- GS1 / SSCC capability
- document intelligence / OCR-assisted receiving

## The Real Gap

The most important current gap is not general WMS breadth.

It is **metafields as a foundational data layer**.

Armstrong's March 2026 kickoff deck is clear: they need a reusable way to identify and operate on many unique items received under generic SKUs. That requires:

- configurable field definitions
- typed value capture at receiving
- LP / inventory lifecycle propagation
- search and allocation by those values
- reporting, documents, labels, and manifests using those values

That foundation does not exist yet in the current product.

## Business Interpretation

There are really two separate questions:

1. Did Armstrong pick the right direction by moving toward a modern WMS?
   - `Yes`
   - Ramola WMS already covers most of the original replacement criteria well

2. Is the product already ready for Armstrong's real-world "many unique items under one SKU" operating model?
   - `No, not yet`
   - the metafields layer is still missing

## Recommendation

Do not frame this as "the WMS is missing lots of basic capability."

That is not the right conclusion.

The better framing is:

- the platform is already broad enough to be credible
- the next critical investment is one foundational capability
- that capability is metafields

## Recommended Message to Stakeholders

Ramola WMS is already well aligned with Armstrong's original modernization goals and exceeds them in several operational areas. The main remaining product gap is a foundational metafields layer needed to support Armstrong's current receiving and allocation model for many unique items under generic SKUs. That should be treated as a top-tier roadmap item rather than as a minor enhancement.

## Decision Recommendation

Approve the metafields workstream as a first-class product initiative.

It should be treated as:

- architectural
- cross-workflow
- prerequisite for future receiving improvements such as blind receiving and image-driven intake at Armstrong scale

## See Also

- [armstrong-wms-side-by-side-gap-analysis.md](/Users/cisco.sanchez/Sales/armstrong/wms/docs/armstrong-wms-side-by-side-gap-analysis.md)
