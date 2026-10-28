# Orbit — microservices e-commerce platform

A complete, real microservices application that ties together **microservices + Docker + docker-compose + CI/CD + Terraform (AWS) + Kubernetes**.

## Architecture
**Microservices (local, docker-compose):**
![Microservices](docs/architecture-microservices.png)

**On AWS (Terraform + EKS):**
![AWS](docs/architecture-aws.png)

**On Kubernetes (namespace: orbit):**
![Kubernetes](docs/architecture-kubernetes.png)

```
                         ┌──────────── gateway (edge, :8080) ────────────┐
Users → web (nginx) ───▶ │  /api/auth → auth     /api/cart → cart        │
                         │  /api/catalog → catalog  /api/orders → orders │
                         └───────────────────────────────────────────────┘
   auth ─▶ Postgres(auth)     catalog ─▶ Postgres(catalog)
   cart ─▶ Redis              orders ─▶ Postgres(orders) ─▶ RabbitMQ ─▶ notifications (worker)
```

## What's inside
- **6 microservices** (Node/Express), each its own code, `package.json`, and Dockerfile:
  - `gateway` — API gateway / reverse proxy (single entry for the frontend).
  - `auth` — register/login/JWT (Postgres + bcrypt).
  - `catalog` — products (Postgres, seeded).
  - `cart` — shopping cart (Redis, JWT-protected).
  - `orders` — place/list orders (Postgres), **publishes events to RabbitMQ**.
  - `notifications` — a worker that **consumes order events** and "sends" confirmations.
- **web** — a polished storefront UI (HTML/CSS/JS) served by nginx, talking only to the gateway.
- **Data**: 3× Postgres, Redis, RabbitMQ.
- **docker-compose.yml** — run the whole platform locally with one command.
- **.github/workflows/** — `ci.yml` (build/test every service + validate compose) and `cd.yml` (build+push images to ECR, deploy to EKS).
- **infra/terraform/** — modular AWS: **VPC + EKS + RDS (Postgres) + ElastiCache (Redis) + ECR**.
- **k8s/** — Kustomize manifests: every service + datastore as Deployments/Services, Secrets/ConfigMap, Ingress, and HPAs.

## Repo layout
```
orbit/
├── docker-compose.yml
├── .env.example
├── services/            gateway, auth, catalog, cart, orders, notifications  (code + Dockerfile)
├── web/                 storefront UI + nginx + Dockerfile
├── .github/workflows/   ci.yml, cd.yml
├── infra/terraform/     modules: network, eks, ecr, data (rds + elasticache)
├── k8s/                 kustomize: base/ + overlays/ (dev, staging, prod)
└── scripts/             compose.sh, minikube.sh, deploy.sh, destroy.sh, test.sh
```

## Scripts
| Script | What it does |
|---|---|
| `./scripts/compose.sh up` / `down` | run the whole app locally with Docker Compose |
| `./scripts/minikube.sh up [env]` / `down` | deploy an overlay to a local minikube cluster |
| `./scripts/deploy.sh <dev\|staging\|prod>` | build the AWS infra (first run) + push images + deploy that env to EKS |
| `./scripts/destroy.sh <dev\|staging\|prod\|all>` | remove one env, or `all` to terraform-destroy everything |
| `./scripts/test.sh <compose\|dev\|staging\|prod>` | end-to-end smoke test (register → cart → order → event) |

---

## Run locally (Docker Compose)
```bash
./scripts/compose.sh up          # start everything
# open http://localhost:3000
docker compose logs -f notifications   # watch order events
./scripts/compose.sh down        # stop (keep data)
./scripts/compose.sh down -v     # stop + wipe volumes
```
- Open the store at **http://localhost:3000**, register, add to cart, place an order.
- RabbitMQ console: **http://localhost:15672** (orbit / orbit).

## Environments
`k8s/base/` holds the manifests; `k8s/overlays/{dev,staging,prod}/` set the namespace and replica count per environment:

| Env | Namespace | Replicas | Autoscaling |
|---|---|---|---|
| dev | `orbit-dev` | 1 | — |
| staging | `orbit-staging` | 2 | — |
| prod | `orbit-prod` | 3 | HPA (gateway, catalog) |

## Deploy to Kubernetes (local minikube)
```bash
./scripts/minikube.sh up dev     # build images into the cluster + apply the dev overlay
./scripts/test.sh dev            # smoke test
minikube service web -n orbit-dev
```

## Deploy to AWS (EKS)
One EKS cluster hosts all three namespaces. `deploy.sh` builds the infra on first run, pushes images to ECR, deploys the env, and exposes `web` as a public LoadBalancer:
```bash
aws configure                              # your AWS credentials (one time)
export TF_VAR_db_password='...'
./scripts/deploy.sh dev                    # build cluster + deploy dev, prints the live URL
./scripts/deploy.sh staging                # same cluster, staging namespace
./scripts/deploy.sh prod                   # same cluster, prod namespace
./scripts/destroy.sh all                   # tear everything down (stops billing)
```
On push to `main`, the **CD** workflow (`.github/workflows/cd.yml`) builds + pushes images to **ECR** and deploys the **prod** overlay (`kubectl apply -k k8s/overlays/prod`) — only once `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets are set.

## Notes
- Default dev secrets live in `.env.example` — change `JWT_SECRET` and passwords for anything real.
- The frontend calls only `/api/*`; nginx proxies that to the `gateway`, which routes to each service — the browser never talks to a service directly.
- Terraform validates (`terraform validate`), docker-compose validates (`docker compose config`), and the k8s manifests render with `kubectl kustomize k8s/`.
