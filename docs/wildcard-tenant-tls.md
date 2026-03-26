# Wildcard Tenant TLS

The WMS platform now expects wildcard TLS for tenant subdomains under `*.wms.ramola.app`.

## Why

HTTP-01 ACME only covered explicitly listed hosts like `wms.ramola.app` and `armstrong.wms.ramola.app`.
That breaks newly created tenants such as `diego-family.wms.ramola.app` with certificate errors.

The production Traefik config now uses DNS-01 challenge through Cloudflare and requests:

- `wms.ramola.app`
- `*.wms.ramola.app`

## Required Production Secrets

Set these in the production `.env` before deploying:

- `CLOUDFLARE_DNS_API_TOKEN`

## Cloudflare Requirements

- `ramola.app` must be delegated to Cloudflare nameservers.
- The API token should have `Zone:DNS Edit` and `Zone:Read` for `ramola.app`.
- A wildcard DNS record for `*.wms.ramola.app` should point at the VPS.

## Routing Shape

- `wms.ramola.app` remains the base admin/login domain.
- `{tenant}.wms.ramola.app` is now handled dynamically by Traefik.
- `storage.wms.ramola.app` keeps its own router with higher priority so it does not fall into the WMS wildcard route.
