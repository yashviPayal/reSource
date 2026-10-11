# Cloud Native Applications & DevOps: Complete Microservices Architecture & Implementation Guide

---

## 📑 Table of Contents
1. [Assignment Rubric & Strategy (20 Marks Breakdown)](#1-assignment-rubric--strategy)
2. [Clearing the Core Confusions (Terraform vs CI/CD vs K8s vs Lambda)](#2-clearing-the-core-confusions)
3. [Proposed Microservices Architecture & Splitting](#3-proposed-microservices-architecture--splitting)
4. [Asynchronous Communication: Kafka vs. RabbitMQ vs. Redis](#4-asynchronous-communication-queue--event-driven)
5. [Database-per-Service Pattern Explained](#5-database-per-service-pattern)
6. [API Gateway Architecture](#6-api-gateway-architecture)
7. [DevSecOps Strategy: Tooling Across the Lifecycle](#7-devsecops-pipeline-integration)
8. [Infrastructure as Code (Terraform) Blueprint](#8-infrastructure-as-code-terraform-blueprint)
9. [Kubernetes (K8s) Architecture & Manifests](#9-kubernetes-k8s-architecture)
10. [End-to-End CI/CD Workflow (GitHub Actions)](#10-end-to-end-cicd-workflow)
11. [Step-by-Step Execution Plan (From Monolith to Submission)](#11-step-by-step-execution-plan)

---

## 1. Assignment Rubric & Strategy

| Rubric Component | Marks | What Evaluators Look For | Our Implementation Strategy |
|---|---|---|---|
| **Microservices** | **3** | Single Responsibility, independent services, decoupled DBs, inter-service comms | 4 services: `auth-service`, `resource-service`, `claim-service`, `notification-service` + API Gateway |
| **Docker** | **4** | Multi-stage Dockerfiles, `.dockerignore`, non-root users, `docker-compose.yml` orchestrating all services | Optimized multi-stage Node.js Dockerfiles + complete local `docker-compose.yml` |
| **IaC** | **2** | Terraform scripts provisioning infrastructure reproducibly without manual AWS console clicks | Terraform scripts to provision VPC, EC2/K8s node, Security Groups, and Elastic IP |
| **Kubernetes** | **2** | Pods, Deployments, ClusterIP Services, Ingress, ConfigMaps, Secrets, resource limits | Clean K8s manifests in `k8s/` folder; ingress routing; deployment with health checks |
| **CI/CD Pipeline** | **3** | Automated build, test, container push, and automated deployment trigger on Git push | GitHub Actions workflow: Lint → Test → Scan → Build → Push → Deploy |
| **DevSecOps** | **2** | Security scans at multiple stages: SAST, SCA, Container image CVEs, Secret scanning | **Gitleaks** (secrets) + **Semgrep** (SAST) + **npm audit** (SCA) + **Trivy** (Docker image scan) |
| **Cloud Provider / Local Machine** | **2** | Running on AWS (EC2/EKS) or verified Kubernetes cluster | AWS EC2 (t3.small running lightweight K3s) or AWS EKS + Supabase managed DBs |
| **Publicly Accessible Link** | **2** | Live working URL where the professor can log in and test | Public IP / DNS with Ingress (e.g., DuckDNS or AWS Elastic IP / CloudFront) |
| **Total** | **20** | **Complete end-to-end cloud-native system** | |

---

## 2. Clearing the Core Confusions

### Confusion 1: *"If GitHub Actions deploys code to EC2, what is the role of Terraform?"*

Think of building a house:
- **Terraform is the Civil Construction Crew (Day 0 & Day 1):**
  - Terraform creates the **land, walls, power grid, and plumbing**.
  - In cloud terms: Terraform provisions the **VPC, Subnets, EC2 instances, EKS cluster, Security Groups, IAM Roles, S3 buckets, and Elastic IPs**.
  - **Frequency:** Runs only when infrastructure changes (once or rarely).
- **GitHub Actions (CI/CD) is the Resident Moving In & Changing Furniture (Day 2):**
  - GitHub Actions runs **every time a developer pushes code**.
  - It runs unit tests, scans code for vulnerabilities, builds new Docker container images, pushes them to DockerHub/ECR, and tells the server: *"pull image tag `:abc123` and restart the container."*
- **How they work together:**
  - You can either run Terraform manually once from your terminal to stand up the cluster, **OR** you can have a GitHub Actions workflow (`infra.yml`) that runs `terraform apply` when files in `infra/` change.

```
+--------------------------------------------------------------------+
| Day 0: Terraform (IaC)                                             |
| Terraform Code ---> terraform apply ---> AWS Infra (VPC, EC2, SG)   |
+--------------------------------------------------------------------+
                                  |
                                  v
+--------------------------------------------------------------------+
| Day 2: GitHub Actions (CI/CD)                                      |
| Git Push ---> Test & Security Scans ---> Docker Build & Push       |
|          ---> kubectl rollout / deploy container images onto AWS   |
+--------------------------------------------------------------------+
```

---

### Confusion 2: *"Can I deploy each microservice to AWS Lambda, or should I use Kubernetes?"*

- **The Problem with Lambda here:**
  - Your faculty specifically allocated **2 marks for Kubernetes**.
  - While Lambda is serverless, **it is NOT Kubernetes**. If you deploy on Lambda, you cannot showcase Kubernetes concepts (Pods, Deployments, ClusterIP Services, Ingress Controllers, ConfigMaps).
- **The Correct Approach:**
  - Package each microservice as a **Docker container**.
  - Run the containers inside **Kubernetes**!
  - **Where does Kubernetes run?**
    - **Option A (Recommended for College Project):** An AWS **EC2 instance** (e.g. `t3.small` or `t3.medium`) running **K3s** (a lightweight certified Kubernetes distro that uses only 512MB RAM instead of full-blown EKS which costs $73/month just for the control plane!).
    - **Option B (Local + Cloud Demo):** Run **Minikube** or **Kind** on your laptop for the K8s demonstration and screenshots, and deploy the frontend/API on AWS EC2 or Render for the public URL.
    - Having `k8s/*.yaml` manifests in your GitHub repo guarantees full marks for Kubernetes.

---

## 3. Proposed Microservices Architecture & Splitting

Currently, your project is a **monolith** containing auth validation, item listing, claims logic, and email triggers inside one `resource-service`.

To satisfy the microservices criteria, we split the project into **4 focused microservices + 1 API Gateway**:

```
Client (React Frontend / Browser)
       |
       | HTTPS (Port 80/443)
       v
+-------------------------------------------------------------+
|               API Gateway / Nginx Ingress                   |
+-------------------------------------------------------------+
   | /api/auth/*          | /api/resources/*   | /api/claims/*
   v                      v                    v
+--------------+       +------------------+  +---------------+
| Auth Service |       | Resource Service |  | Claim Service |
| (Port 4002)  |       | (Port 4001)      |  | (Port 4003)   |
+--------------+       +------------------+  +---------------+
       |                        |                    |
       v                        |                    |
[ users table ]                 |                    |
(Auth DB)                       |                    |
                                |                    | Publishes Events
                                |                    | (CLAIM_CREATED,
                                |                    |  CLAIM_STATUS_UPDATED)
                                v                    v
                        +------------------------------------+
                        |  Message Broker (RabbitMQ / Queue) |
                        +------------------------------------+
                                         |
                                         v Consumes Events
                        +------------------------------------+
                        |       Notification Service         |
                        |            (Port 4004)             |
                        +------------------------------------+
                                         |
                                         v Sends Email via API
                                  [ Resend API ]
```

### Microservice Responsibilities:

| Service | Port | Responsibility | Database Table(s) | Communication |
|---|---|---|---|---|
| **API Gateway** | 80 / 4000 | Reverse proxy, routes traffic, handles CORS, TLS termination | None | Reverse Proxy (HTTP) |
| **`auth-service`** | 4002 | User registration, login, password hashing (`bcrypt`), JWT token generation & verification | `users` | REST (Sync) |
| **`resource-service`** | 4001 | CRUD for listings, search, category filtering, condition, location | `resources` | REST (Sync) |
| **`claim-service`** | 4003 | Creates claims, fetches incoming/sent claims history, approves/rejects claims | `claims` | REST (Sync) + Event Publisher |
| **`notification-service`** | 4004 | Consumes events from queue, generates HTML emails, sends via Resend | `email_logs` (optional) | Async Worker (Queue Consumer) |

---

## 4. Asynchronous Communication (Queue / Event-Driven)

### Kafka vs. RabbitMQ vs. Redis: Which one should you pick?

| Criteria | Apache Kafka | RabbitMQ | Redis Pub/Sub |
|---|---|---|---|
| **Primary Use-Case** | High-throughput streaming, log aggregation, event replaying | **Task queues, transactional event publishing, routing** | Real-time caching, transient pub/sub |
| **Memory Footprint** | **Heavy** (Needs 1.5GB - 2GB RAM minimum + JVM/Zookeeper/KRaft) | **Lightweight** (~100MB - 150MB RAM) | **Very Light** (~30MB RAM) |
| **Setup Complexity** | Complex topic partitions & offset configurations | Very simple (Exchanges → Queues) | Simple |
| **Persistence** | Permanent log | Queue persistence until acknowledged | No persistence in basic Pub/Sub |
| **Recommendation for Assignment** | Only if your syllabus strictly mandates the word "Kafka" | ⭐ **Top Pick (Standard for Microservices)** | Good fallback |

> [!TIP]
> **Recommendation:** Use **RabbitMQ** or **Redis Streams**. If your professor specifically demanded **Kafka**, you can use **Upstash Kafka** (cloud-hosted free tier, zero RAM needed) or a lightweight single-node Kafka container in `docker-compose.yml`.

### How Async Email Notification Works:
1. When a user requests an item, `claim-service` does NOT call Resend directly.
2. `claim-service` publishes a JSON payload to the queue:
   ```json
   {
     "event": "CLAIM_CREATED",
     "timestamp": "2026-10-11T18:00:00Z",
     "data": {
       "resourceTitle": "Organic Chemistry Textbook",
       "ownerEmail": "owner@example.com",
       "requesterName": "Rohit",
       "message": "Can I pick this up tomorrow?"
     }
   }
   ```
3. `notification-service` listens to the queue in the background, pulls the message, and calls the Resend API.
4. **Why this earns full marks:** Even if Resend's API is temporarily slow or down, the user's web request completes instantly (low latency) and the queue retries the email automatically (fault tolerance).

---

## 5. Database-per-Service Pattern

In true cloud-native architecture, **services never directly query each other's database tables**.

You have two valid options to implement this:

### Option A: Separate Tables/Schemas in Supabase (Cleanest & Free)
Use your existing Supabase PostgreSQL instance, but divide it logically:
- `auth_db` (or schema `auth`): `users (id, email, password_hash, name, created_at)`
- `catalog_db` (or schema `catalog`): `resources (id, title, category, action, condition, location, description, status, owner_id, owner_email, created_at)`
- `claim_db` (or schema `claim`): `claims (id, resource_id, resource_title, requester_id, requester_name, requester_email, message, status, created_at)`

### Option B: Individual PostgreSQL Containers in Docker Compose
In `docker-compose.yml`:
- `postgres-auth:5432`
- `postgres-catalog:5432`
- `postgres-claims:5432`
Each microservice has its own isolated connection string.

---

## 6. API Gateway Architecture

Instead of the frontend knowing about ports `4001`, `4002`, `4003`, and `4004`, the frontend talks **only** to the Gateway:

```
Frontend -> http://gateway/api/auth/*      -> routes to auth-service:4002
Frontend -> http://gateway/api/resources/* -> routes to resource-service:4001
Frontend -> http://gateway/api/claims/*    -> routes to claim-service:4003
```

- **In Local Dev / Docker:** A lightweight **Nginx** container configured as a reverse proxy.
- **In Kubernetes:** A **Kubernetes Ingress Controller** (like Nginx Ingress or Traefik) that reads an `Ingress` YAML manifest.

---

## 7. DevSecOps Pipeline Integration

Your rubric allocates **2 Marks for DevSecOps**. To get 100% of these marks, you must demonstrate security checks integrated into your CI/CD pipeline across 4 distinct phases:

```
+---------------------------+       +---------------------------+
| 1. Pre-Commit / Code      | ----> | 2. Dependency Scan (SCA)  |
| - Gitleaks (Secrets)      |       | - npm audit               |
| - Semgrep (SAST)          |       | - Snyk                    |
+---------------------------+       +---------------------------+
              |
              v
+---------------------------+       +---------------------------+
| 3. Container Scan (CVEs)  | ----> | 4. IaC Security           |
| - Aqua Trivy Image Scan   |       | - tfsec / checkov         |
+---------------------------+       +---------------------------+
```

### DevSecOps Tooling Matrix:

| Stage | Security Discipline | Tool | What It Catches | CI/CD Command |
|---|---|---|---|---|
| **Code** | **Secrets Detection** | **Gitleaks** | Hardcoded AWS keys, Resend tokens, database passwords | `gitleaks detect --source=.` |
| **Code** | **SAST** (Static Analysis) | **Semgrep** | SQL injection risks, insecure headers, path traversal | `semgrep scan --config=auto` |
| **Dependencies** | **SCA** (Software Composition) | **npm audit** / **Snyk** | Known vulnerabilities (CVEs) in npm dependencies | `npm audit --audit-level=high` |
| **Containers** | **Container Security** | **Aqua Trivy** | Outdated OS libraries, open CVEs in base images (e.g. node:20) | `trivy image --severity HIGH,CRITICAL <image>` |
| **Infrastructure** | **IaC Scanning** | **tfsec** / **Checkov** | Unencrypted S3 buckets, `0.0.0.0/0` security groups in Terraform | `tfsec ./infra` |

---

## 8. Infrastructure as Code (Terraform) Blueprint

Your Terraform configuration in `infra/terraform/` defines the cloud foundation:

### What Terraform Files to Create:
```
infra/terraform/
├── main.tf            # Provider definition (AWS) and backend configuration
├── vpc.tf             # Virtual Private Cloud, Public Subnet, Internet Gateway
├── security_groups.tf # Security group opening ports 80, 443, and 22
├── ec2_k8s.tf         # EC2 instance (Ubuntu 24.04, t3.small) with K3s pre-installed
├── outputs.tf         # Outputs public IP, cluster endpoint, and SSH instructions
└── variables.tf       # AWS region, instance type, key pair name
```

### Why this setup satisfies the evaluator:
1. `terraform init` and `terraform apply` provisions a complete running AWS server.
2. The user data script in `ec2_k8s.tf` automatically installs **K3s (Kubernetes)** and sets up the node.
3. Completely destroys with `terraform destroy` when your grading is complete, so you don't incur AWS costs!

---

## 9. Kubernetes (K8s) Architecture

In Kubernetes, your services run as containerized pods managed by controllers:

### Key Kubernetes Objects:
1. **Namespace:** `resource-app` (keeps assignment resources organized).
2. **Deployments:**
   - `auth-deployment.yaml` (2 replicas for High Availability)
   - `resource-deployment.yaml` (2 replicas)
   - `claim-deployment.yaml` (2 replicas)
   - `notification-deployment.yaml` (1 replica worker)
   - `rabbitmq-deployment.yaml` (StatefulSet or Deployment)
   - `frontend-deployment.yaml` (2 replicas serving static assets via Nginx)
3. **Services (ClusterIP):** Internal DNS discovery (e.g. `http://auth-service.resource-app.svc.cluster.local:4002`).
4. **ConfigMaps & Secrets:** Base64-encoded DB URLs and Resend API keys.
5. **Ingress (`ingress.yaml`):** Exposes HTTP paths to the external world through a single public IP.

---

## 10. End-to-End CI/CD Workflow

Here is how your automated `.github/workflows/devsecops-cicd.yml` workflow executes:

```
Developer Git Push
      │
      ▼
Stage 1: Lint & Unit Tests (npm test)
      │
      ▼
Stage 2: DevSecOps Scanners
      ├── Gitleaks (Secrets Scan)
      ├── npm audit (Dependency Scan)
      └── Semgrep (SAST Code Scan)
      │
      ▼
Stage 3: Container Build & Image Security
      ├── Docker build microservices
      ├── Trivy Vulnerability Scan on Docker images
      └── Push to Docker Hub / GitHub Container Registry (GHCR)
      │
      ▼
Stage 4: Automated Deployment
      ├── kubectl set image deployment/* (Rolling Update)
      └── Smoke test / health check (/health endpoint)
```

---

## 11. Step-by-Step Execution Plan

To complete this assignment smoothly without getting overwhelmed, follow these structured phases:

### Phase 1: Split the Code into Services (The Microservices Step)
1. In `services/`, create 3 folders:
   - `auth-service/`
   - `resource-service/` (retain catalog logic)
   - `claim-service/`
   - `notification-service/`
2. Write a minimal standalone Express app for each:
   - `auth-service`: `/api/auth/register`, `/api/auth/login`, `/api/auth/me` (issues standard JWT).
   - `resource-service`: `/api/resources` (GET/POST/DELETE).
   - `claim-service`: `/api/claims` (POST request, GET history, PATCH approve/reject).
   - `notification-service`: connects to queue and triggers Resend emails.

### Phase 2: Local Containerization & Docker Compose
1. Add a `Dockerfile` for each service.
2. Update root `docker-compose.yml` to spin up:
   - `frontend`
   - `api-gateway` (Nginx)
   - `auth-service`
   - `resource-service`
   - `claim-service`
   - `notification-service`
   - `rabbitmq` (or Redis)
   - `postgres` (or link to Supabase)
3. Test locally with `docker compose up --build`.

### Phase 3: Setup DevSecOps & GitHub Actions CI
1. Create `.github/workflows/ci-cd.yml`.
2. Add jobs for:
   - Unit tests
   - Gitleaks scan
   - Trivy container scan
   - Docker build & push to Docker Hub (free public registry).

### Phase 4: Kubernetes Manifests (`k8s/`)
1. Create a `k8s/` folder containing manifests for each service.
2. Test deployment using Minikube or directly on your remote EC2 node.
3. Verify that `kubectl get pods -n resource-app` shows all microservices `Running`.

### Phase 5: Infrastructure as Code (Terraform)
1. Write the Terraform configuration in `infra/terraform/`.
2. Run `terraform apply` to prove IaC provisioning.
3. Take terminal screenshots of `terraform plan` and `terraform apply` for your report.

### Phase 6: Final Submission Packaging
1. Record/deploy your public link (via EC2 Elastic IP or DuckDNS domain).
2. Take screenshots of:
   - Microservices running in Docker / Kubernetes (`docker ps` and `kubectl get pods`).
   - GitHub Actions pipeline showing green checkmarks on DevSecOps scans and deployment.
   - Terraform deployment logs.
   - Live website demonstrating login, listing an item, requesting it, and receiving an email.

---

*Document generated for the Cloud Native Applications & DevOps (CNA) Assignment.*
