# Armstrong Digital Ecosystem

## Overview

Armstrong operates multiple systems that together support the full lifecycle from customer identification through cash collection. This document maps the entire ecosystem, identifies gaps, and defines the integration architecture.

## System Inventory

| System | Status | Purpose |
|--------|--------|---------|
| **NetSuite ERP** | Exists | Financials, billing, AR/AP, customer records, contracts |
| **DispatchPro TMS** | Exists | Load management, carrier dispatch, tracking |
| **Armstrong WMS** | Building | Receiving, inventory, fulfillment, warehouse ops |
| **Operator Mobile App** | Needs building | RF scanning, pick/pack, receiving on floor |
| **Client Portal** | Needs building | Customer self-service inventory/orders/billing |
| **Marketplace Connectors** | Needs building | Shopify, Amazon, Walmart, EDI 940/945 |
| **Carrier Integrations** | Needs building | UPS/FedEx/USPS APIs, rate shopping, labels |
| **Sales CRM** | Gap — NetSuite CRM or HubSpot? | Lead management, quoting, contract mgmt |
| **Yard Management** | Gap | Dock scheduling, trailer tracking, gate check-in |
| **Billing Engine** | Gap (WMS → NetSuite bridge) | Activity-based billing calc from WMS events |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ARMSTRONG DIGITAL ECOSYSTEM                               │
│                                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  WEBSITE &   │  │   NETSUITE   │  │ DISPATCH PRO │  │    ARMSTRONG WMS     │ │
│  │  SALES CRM   │  │   (ERP)      │  │  (TMS)       │  │  (This project)     │ │
│  │              │  │              │  │              │  │                      │ │
│  │  Lead gen    │  │  Financials  │  │  Load mgmt   │  │  Receiving           │ │
│  │  Quoting     │  │  Billing     │  │  Carrier     │  │  Inventory           │ │
│  │  Proposals   │  │  AP/AR       │  │  Tracking    │  │  Fulfillment         │ │
│  │  Contracts   │  │  Revenue     │  │  Dispatch    │  │  Locations           │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│         │                  │                  │                     │             │
│  ┌──────┴──────────────────┴──────────────────┴─────────────────────┴──────────┐ │
│  │                        INTEGRATION LAYER (APIs / Events)                    │ │
│  └──────┬──────────────────┬──────────────────┬─────────────────────┬──────────┘ │
│         │                  │                  │                     │             │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────────┴───────────┐ │
│  │  OPERATOR    │  │   CLIENT     │  │  MARKETPLACE │  │   CARRIER            │ │
│  │  MOBILE APP  │  │   PORTAL     │  │  CONNECTORS  │  │   INTEGRATIONS       │ │
│  │              │  │              │  │              │  │                      │ │
│  │  RF scanning │  │  Inventory   │  │  Shopify     │  │  UPS/FedEx/USPS      │ │
│  │  Pick/pack   │  │  Orders      │  │  Amazon      │  │  LTL carriers        │ │
│  │  Receiving   │  │  Reports     │  │  Walmart     │  │  Rate shopping       │ │
│  │  Cycle count │  │  Billing     │  │  EDI 940/945 │  │  Label generation    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## The 6 Applications

```
1. ARMSTRONG WMS (web)          ← This project — command center for warehouse managers
2. OPERATOR APP (mobile/tablet) ← Warehouse floor companion for workers (PWA)
3. CLIENT PORTAL (web)          ← Customer-facing self-service for cargo owners
4. DISPATCH PRO (existing)      ← Transport management system
5. NETSUITE (existing)          ← ERP / financials / billing
6. INTEGRATION HUB              ← Glue between all systems (APIs + webhooks + EDI)
```

## Application Architecture Decision

The Operator App and Client Portal are NOT separate codebases — they are additional route groups within the Armstrong WMS Next.js application:

```
src/app/
├── (tenant)/          ← WMS back-office (warehouse managers, admins)
├── (operator)/        ← Mobile-optimized warehouse floor UI (PWA)
│   ├── receive/       ← Scan-to-receive workflow
│   ├── pick/          ← Pick task execution
│   ├── pack/          ← Packing station
│   ├── move/          ← Bin-to-bin transfers
│   └── count/         ← Cycle count execution
├── (portal)/          ← Client-facing portal (cargo owners)
│   ├── inventory/     ← Stock visibility
│   ├── orders/        ← Place and track orders
│   ├── shipments/     ← Tracking
│   ├── billing/       ← Invoices and payment
│   └── reports/       ← Custom reports
└── (platform)/        ← Superadmin / Armstrong internal
    ├── tenants/       ← Tenant management
    └── billing/       ← Cross-tenant billing dashboard
```

**Benefits of single codebase:**
- One database, one deployment, one set of business logic
- Shared components and design system
- Unified auth (same user can have WMS admin + operator roles)
- Operator App is a PWA installable on warehouse tablets/scanners
- Client Portal has its own auth flow (client users vs Armstrong users)

## Critical Integration Flows

```
WMS ──── billable events ────→ NetSuite (receiving, storage, handling charges)
WMS ←─── customer/rate data ──── NetSuite (client records, contracts, rate cards)
WMS ──── ship requests ──────→ DispatchPro (LTL/FTL loads)
WMS ←─── tracking updates ───── DispatchPro (delivery status, POD)
WMS ←─── orders ──────────────── Marketplaces (Shopify, Amazon, Walmart, EDI 940)
WMS ──── tracking/inventory ──→ Marketplaces (stock sync, tracking push, EDI 945)
WMS ──── label requests ─────→ Carrier APIs (UPS, FedEx, USPS)
WMS ←─── labels/tracking ────── Carrier APIs
WMS ──── real-time data ─────→ Client Portal (inventory, orders, shipments)
WMS ←─── manual orders ──────── Client Portal
Operator App ←──→ WMS (same DB, real-time sync via server actions)
```
