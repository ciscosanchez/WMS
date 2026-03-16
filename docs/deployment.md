# Deployment Guide

## Overview

Armstrong WMS is containerized and runs the same way locally and in production. Docker locally → same image on AWS. No code changes needed to move between environments — just config.

## Architecture

### Local Development

```
┌─────────────────────────────────────────────┐
│              Docker Compose                  │
│                                              │
│  ┌──────────────┐    ┌──────────────────┐   │
│  │  PostgreSQL   │    │     MinIO         │   │
│  │  16-alpine    │    │  (S3-compatible)  │   │
│  │  port: 5432   │    │  port: 9000/9001 │   │
│  └──────────────┘    └──────────────────┘   │
│                                              │
└─────────────────────────────────────────────┘

  Next.js dev server (npm run dev) on host machine
  Connects to Postgres + MinIO in containers
```

### AWS Production

```
┌─────────────────────────────────────────────────────────────┐
│                          AWS                                 │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Route 53│───►│  CloudFront  │───►│  App Runner      │   │
│  │  (DNS)   │    │  (CDN + SSL) │    │  or ECS Fargate  │   │
│  └──────────┘    └──────────────┘    │  (Next.js)       │   │
│                                       └────────┬─────────┘   │
│  Subdomains:                                   │             │
│  acme.wms.yourco.com                           │             │
│  globex.wms.yourco.com           ┌─────────────┴──────┐     │
│  portal.wms.yourco.com           │                     │     │
│                                   ▼                     ▼     │
│                          ┌──────────────┐    ┌─────────────┐ │
│                          │ RDS Postgres │    │     S3      │ │
│                          │ 16           │    │  (docs/     │ │
│                          │ Multi-AZ     │    │   photos)   │ │
│                          │ auto-backup  │    └─────────────┘ │
│                          └──────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## What Changes Between Local and AWS

| Component | Local | AWS | How to switch |
|-----------|-------|-----|---------------|
| **Database** | Docker Postgres | RDS PostgreSQL 16 | Change `DATABASE_URL` |
| **File storage** | MinIO container | S3 | Change `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| **Tenant resolution** | `x-tenant-slug` header | Subdomain extraction | Change `TENANT_RESOLUTION=subdomain` |
| **App hosting** | `npm run dev` | App Runner / ECS Fargate | Push Docker image to ECR |
| **SSL** | None (localhost) | ACM certificate + CloudFront | AWS managed |
| **DNS** | localhost:3000 | Route 53 → CloudFront | Configure domain |
| **Secrets** | `.env` file | AWS Secrets Manager / SSM | Reference in task definition |

**No code changes.** Only environment variables.

## Environment Variables

### Local (.env)

```bash
DATABASE_URL="postgresql://armstrong:armstrong_dev@localhost:5432/armstrong_wms?schema=public"
AUTH_SECRET="dev-secret-change-in-production-min-32-chars!!"
AUTH_URL="http://localhost:3000"
TENANT_RESOLUTION="header"
USE_MOCK_DATA="false"
S3_ENDPOINT="localhost"
S3_PORT=9000
S3_ACCESS_KEY="armstrong"
S3_SECRET_KEY="armstrong_dev"
S3_BUCKET="armstrong-wms"
S3_USE_SSL=false
```

### AWS Production

```bash
DATABASE_URL="postgresql://armstrong:STRONG_PASSWORD@armstrong-wms.abc123.us-east-1.rds.amazonaws.com:5432/armstrong_wms?schema=public"
AUTH_SECRET="generated-64-char-secret-from-openssl-rand-base64-48"
AUTH_URL="https://wms.yourcompany.com"
TENANT_RESOLUTION="subdomain"
USE_MOCK_DATA="false"
S3_ENDPOINT="s3.amazonaws.com"
S3_PORT=443
S3_ACCESS_KEY="AKIA..."
S3_SECRET_KEY="..."
S3_BUCKET="armstrong-wms-prod"
S3_USE_SSL=true
```

## Local Development Setup

### Prerequisites
- Docker Desktop (Apple Silicon: https://www.docker.com/products/docker-desktop/)
- Node.js 20+ (22 recommended)
- npm

### Step-by-step

```bash
# 1. Start infrastructure
docker compose up -d

# Verify containers are running
docker compose ps
# Should show: postgres (healthy), minio (healthy)

# 2. Generate Prisma clients
npm run db:generate

# 3. Create public schema tables
npm run db:push

# 4. Seed demo data (admin user, demo tenant, sample warehouse/products/clients)
npm run db:seed

# 5. Switch from mock data to real database
# Edit .env: USE_MOCK_DATA="false"

# 6. Set tenant cookie for dev mode
# Open browser DevTools console:
# document.cookie = "tenant-slug=demo"

# 7. Start dev server
npm run dev

# 8. Login at http://localhost:3000/login
# Email: admin@armstrong.dev
# Password: admin123
```

### Useful commands

```bash
# View database with Prisma Studio
npm run db:studio

# View MinIO console
# Open http://localhost:9001
# Login: armstrong / armstrong_dev

# Stop infrastructure
docker compose down

# Stop and delete all data
docker compose down -v

# View container logs
docker compose logs -f postgres
docker compose logs -f minio
```

## AWS Deployment

### Option A: AWS App Runner (simplest)

App Runner builds and deploys from a Docker image or source code. Best for getting started quickly.

```bash
# 1. Create ECR repository
aws ecr create-repository --repository-name armstrong-wms

# 2. Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t armstrong-wms .
docker tag armstrong-wms:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/armstrong-wms:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/armstrong-wms:latest

# 3. Create App Runner service (via console or CLI)
# - Source: ECR image
# - Port: 3000
# - Environment variables: set from Secrets Manager
# - Auto-scaling: 1-10 instances
# - Custom domain: wms.yourcompany.com
```

### Option B: ECS Fargate (more control)

For production workloads that need more control over networking, scaling, and costs.

```bash
# Key resources to create:
# - ECS Cluster
# - Task Definition (references ECR image + env vars from Secrets Manager)
# - ECS Service (Fargate launch type, desired count: 2)
# - ALB (Application Load Balancer) with target group
# - CloudFront distribution (optional CDN layer)
# - Route 53 records (wildcard *.wms.yourcompany.com)
```

### Database: RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier armstrong-wms \
  --db-instance-class db.t4g.medium \
  --engine postgres \
  --engine-version 16 \
  --master-username armstrong \
  --master-user-password <STRONG_PASSWORD> \
  --allocated-storage 50 \
  --storage-type gp3 \
  --multi-az \
  --backup-retention-period 7 \
  --db-name armstrong_wms

# After creation, run migrations:
DATABASE_URL="postgresql://armstrong:<password>@<rds-endpoint>:5432/armstrong_wms?schema=public" \
  npx prisma db push --schema=prisma/schema.prisma
```

### File Storage: S3

```bash
# Create S3 bucket
aws s3 mb s3://armstrong-wms-prod --region us-east-1

# Set CORS for pre-signed uploads
aws s3api put-bucket-cors --bucket armstrong-wms-prod --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://wms.yourcompany.com", "https://*.wms.yourcompany.com"],
    "MaxAgeSeconds": 3600
  }]
}'
```

### DNS: Subdomain Routing

For multi-tenant subdomain routing (`acme.wms.yourcompany.com`):

```
Route 53:
  *.wms.yourcompany.com  →  CNAME → CloudFront distribution
  wms.yourcompany.com    →  ALIAS → CloudFront distribution

CloudFront:
  Alternate domain names: *.wms.yourcompany.com, wms.yourcompany.com
  SSL certificate: ACM wildcard cert for *.wms.yourcompany.com
  Origin: App Runner / ALB
```

The WMS middleware automatically extracts the subdomain (`acme`) from the host header and uses it to resolve the tenant.

## CI/CD Pipeline (Future)

```
GitHub Push → GitHub Actions → Build Docker → Push to ECR → Deploy to App Runner/ECS

.github/workflows/deploy.yml:
  - Run tests (npm run validate)
  - Build Docker image
  - Push to ECR
  - Trigger App Runner deployment
```

## Cost Estimates (AWS)

### Starter (1-5 tenants)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| App Runner | 1 vCPU, 2GB, auto-pause | ~$25-50 |
| RDS Postgres | db.t4g.micro, single-AZ | ~$15 |
| S3 | 10GB storage | ~$1 |
| Route 53 | Hosted zone + queries | ~$1 |
| **Total** | | **~$42-67/month** |

### Growth (10-50 tenants)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| ECS Fargate | 2 tasks, 1 vCPU, 2GB each | ~$75 |
| RDS Postgres | db.t4g.medium, Multi-AZ | ~$140 |
| S3 | 100GB storage | ~$3 |
| CloudFront | CDN | ~$10 |
| ALB | Load balancer | ~$20 |
| **Total** | | **~$248/month** |

### Production (50+ tenants)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| ECS Fargate | 4 tasks, 2 vCPU, 4GB | ~$300 |
| RDS Postgres | db.r6g.large, Multi-AZ, read replica | ~$500 |
| ElastiCache Redis | Session/cache layer | ~$50 |
| S3 | 1TB storage | ~$23 |
| CloudFront | CDN | ~$50 |
| ALB | Load balancer | ~$20 |
| **Total** | | **~$943/month** |
