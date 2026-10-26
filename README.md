# Orbit — microservices e-commerce platform (two-session capstone)

A complete, real microservices application that ties together everything: **microservices + Docker + docker-compose + CI/CD + Terraform (AWS) + Kubernetes**. Built to be walked through across two 3-hour sessions.

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
└── k8s/                 kustomize: namespace, config, infra/, services/, ingress, hpa
```

---

## Session 1 — build & run locally (microservices + Docker + compose + CI)
1. Tour the architecture and each microservice's code (gateway → auth → catalog → cart → orders → notifications → web).
2. Read each **Dockerfile**.
3. Run it all:
   ```bash
   cp .env.example .env
   docker compose up --build
   ```
4. Open the store at **http://localhost:3000**, register, add to cart, place an order.
   - Watch the event flow: `docker compose logs -f notifications` prints the order confirmation.
   - RabbitMQ console: http://localhost:15672 (orbit / orbit).
5. Walk the **CI** workflow (`.github/workflows/ci.yml`): builds every service image and validates compose.

## Session 2 — ship it (Terraform + Kubernetes + CD)
1. **Terraform** (`infra/terraform/`) — provision AWS: VPC, EKS, RDS, ElastiCache, ECR.
   ```bash
   cd infra/terraform
   export TF_VAR_db_password='...'
   terraform init
   terraform plan
   terraform apply
   ```
2. **Kubernetes** (`k8s/`) — deploy the same platform to a cluster (local minikube or EKS).
   - Local (minikube): build images in, then apply.
     ```bash
     eval $(minikube docker-env)
     for s in gateway auth catalog cart orders notifications; do docker build -t orbit-$s:latest ./services/$s; done
     docker build -t orbit-web:latest ./web
     kubectl apply -k k8s/
     kubectl get pods -n orbit -w
     minikube service web -n orbit
     ```
3. **CD** (`.github/workflows/cd.yml`) — on push to `main`, build+push images to **ECR** and `kubectl apply -k k8s/` + roll out new images to **EKS**.

---

## Local run — quick reference
```bash
docker compose up --build        # start everything
# open http://localhost:3000
docker compose logs -f notifications
docker compose down              # stop (keep data)
docker compose down -v           # stop + wipe volumes
```

## Notes
- Default dev secrets live in `.env.example` — change `JWT_SECRET` and passwords for anything real.
- The frontend calls only `/api/*`; nginx proxies that to the `gateway`, which routes to each service — the browser never talks to a service directly.
- Terraform validates (`terraform validate`), docker-compose validates (`docker compose config`), and the k8s manifests render with `kubectl kustomize k8s/`.
