# ♻️ reSource — Cloud Native Microservices Platform

[![Kubernetes](https://img.shields.io/badge/Kubernetes-K3s%20%7C%20Minikube-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![AWS](https://img.shields.io/badge/AWS-EC2%20%7C%20VPC-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![RabbitMQ](https://img.shields.io/badge/Message_Broker-RabbitMQ-FF6600?logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![DevSecOps](https://img.shields.io/badge/Security-Gitleaks%20%7C%20Semgrep%20%7C%20Trivy-green)](https://github.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20TypeScript-61DAFB?logo=react&logoColor=black)](https://react.dev/)

> **reSource** is a modern **Circular Economy & Waste Reduction Platform** built to give reusable items a second life through **Donate, Reuse, Repair, and Recycle**. 
>
> Originally designed as a monolithic proof-of-concept, the platform has been re-architected into an enterprise **Cloud Native Microservices Architecture** featuring automated **Infrastructure as Code (Terraform)**, **Kubernetes Orchestration (K3s/Minikube)**, **Event-Driven Messaging (RabbitMQ)**, and a **Shift-Left DevSecOps CI/CD pipeline**.

---

## 🏗️ System Architecture

The platform follows a decoupled, resilient microservices architecture orchestrated via Kubernetes:

```
                            User (Browser / Vercel Frontend)
                                           │
                       Port 80 (HTTP) / Port 443 (HTTPS)
                                           ▼
                            [ Kubernetes Ingress ]
                                (Traefik / NGINX)
                                           │
                                           ▼
                       [ API Gateway (NodePort 30000) ]
                               (Express Proxy)
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
     [ Auth Service ]             [ Resource Service ]          [ Claim Service ]
      (Port: 4002)                  (Port: 4001)                  (Port: 4003)
      • JWT Cookies & Tokens        • Catalog Management          • Claim State Machine
      • Bcrypt Password Hash        • Category/Action Filters     • Concurrency Protection
             │                             │                             │
             │ (SQL Pool)                  │ (SQL Pool)                  │ (Publishes: claim.created)
             ▼                             ▼                             ▼
     [ PostgreSQL DB ]             [ PostgreSQL DB ]           [ RabbitMQ Broker ]
     (Local / Supabase)            (Local / Supabase)          (Port: 5672 / UI: 31672)
                                                                         │
                                                                         │ (Consumes events)
                                                                         ▼
                                                             [ Notification Service ]
                                                              (Port: 4004 - Background)
                                                              • Asynchronous Queue Consumer
                                                              • Resend Email Dispatcher
```

### Microservices Catalog

| Service | Port | Responsibilities | Key Technologies |
| :--- | :--- | :--- | :--- |
| **`api-gateway`** | `4000` | Single entry point, CORS management, routing, reverse proxy | Express, `express-http-proxy`, Helmet |
| **`auth-service`** | `4002` | User registration, login, JWT cookie generation, bcrypt hashing | Express, PostgreSQL, JWT |
| **`resource-service`** | `4001` | Listings catalog, search, category filters, item creation | Express, PostgreSQL, Input Validation |
| **`claim-service`** | `4003` | Item claim requests, status lifecycle, RabbitMQ event producer | Express, PostgreSQL, `amqplib` |
| **`notification-service`**| `4004` | Event-driven async email worker, dead-letter retries, Resend API | Express, `amqplib`, Resend SDK |
| **`frontend`** | `5173` | Responsive circular economy web application | React 18, Vite, TypeScript, Tailwind |

---

## ⚡ Zero-Effort Quickstart Guide

You can run the entire system locally on either **Windows** or **Linux** in less than 2 minutes.

### Prerequisites
- **Docker Desktop** installed and running.
- **Node.js 20+** installed.
- **Git** installed.

---

### Option A: 1-Command Local Run via Docker Compose (Recommended for Development)

Docker Compose starts all 5 microservices, 3 isolated PostgreSQL databases, and the RabbitMQ message broker with explicit project namespacing (`cna-resource`) to prevent container collisions.

#### 🪟 Windows (PowerShell)
```powershell
# 1. Clone the repository
git clone https://github.com/CipherHitro/reSource.git
cd reSource

# 2. Start all backend microservices, databases & RabbitMQ
docker compose -f backend/docker-compose.yml up -d --build

# 3. Start the Frontend
cd frontend
npm install
npm run dev
```

#### 🐧 Linux / macOS (Bash)
```bash
# 1. Clone the repository
git clone https://github.com/CipherHitro/reSource.git
cd reSource

# 2. Start all backend microservices, databases & RabbitMQ
docker compose -f backend/docker-compose.yml up -d --build

# 3. Start the Frontend
cd frontend
npm install
npm run dev
```

#### Access Your Local Environment:
- 🌐 **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- 🔌 **API Gateway Health:** [http://localhost:4000/health](http://localhost:4000/health)
- 🐇 **RabbitMQ Management Dashboard:** [http://localhost:15672](http://localhost:15672) *(User: `guest` | Pass: `guest`)*

---

### Option B: Local Kubernetes Run via Minikube

To test the production Kubernetes manifests locally:

```bash
# 1. Start Minikube
minikube start

# 2. Build and load images into Minikube
docker compose -f backend/docker-compose.yml build
minikube image load cna-resource-auth-service:latest
minikube image load cna-resource-resource-service:latest
minikube image load cna-resource-claim-service:latest
minikube image load cna-resource-notification-service:latest
minikube image load cna-resource-api-gateway:latest

# 3. Deploy the entire stack with Kustomize (1 command)
kubectl apply -k k8s/

# 4. Port forward API Gateway to test
kubectl port-forward svc/api-gateway -n resource-app 4000:4000
```

---

### Option C: Cloud Deployment on AWS with Terraform (Production)

Deploy the entire cloud infrastructure on AWS EC2 with K3s Kubernetes in 3 commands:

```bash
cd infra/terraform

# 1. Initialize Terraform
terraform init

# 2. Review resources (VPC, Subnet, Security Group, EC2, Elastic IP)
terraform plan

# 3. Provision cloud cluster with automated cloud-init bootstrap
terraform apply -auto-approve
```

*When done, run `terraform destroy -auto-approve` to cleanly tear down the resources and avoid cloud charges.*

---

## 🛡️ DevSecOps & CI/CD Pipeline

The project implements a comprehensive **Shift-Left DevSecOps** pipeline in [`.github/workflows/ci.yml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/.github/workflows/ci.yml):

```
[ Git Push / PR ] 
       │
       ├──► 1. Secrets Detection (Gitleaks)
       │    Scans git history for hardcoded tokens, passwords, and private keys.
       │
       ├──► 2. SAST Analysis (Semgrep)
       │    Scans JavaScript source code against OWASP Top 10 security standards.
       │
       ├──► 3. SCA Audit (npm audit)
       │    Verifies all npm dependencies are free from known high/critical CVEs.
       │
       ├──► 4. Automated Testing (Node.js Test Runner)
       │    Executes unit tests across all 5 microservices in parallel.
       │
       └──► 5. Container Scanning (Aqua Security Trivy)
            Builds and scans container images for base OS vulnerabilities.
```

### Gated Continuous Deployment (`deploy-aws.yml`)
Deployments to the production AWS EC2 K3s cluster trigger **only after all CI & DevSecOps security checks pass 100% green**:
- **Dynamic IP Discovery:** Queries the AWS EC2 API to find the live server IP.
- **In-Memory Secret Injection:** Dynamically creates Kubernetes Secrets directly from GitHub Secrets without writing credentials to disk or Git.
- **Zero-Downtime Rolling Restarts:** Updates running pods gracefully without interrupting traffic.

---

## 📡 API Reference

All requests route through the **API Gateway** on Port `4000`:

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT cookie | No |
| `POST` | `/api/auth/logout` | Clear auth session | Yes |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes |

### Resource Catalog (`/api/resources`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/resources` | Query listings (supports `search`, `category`, `action`, `sort`) | No |
| `GET` | `/api/resources/:id` | Fetch detailed listing by ID | No |
| `POST` | `/api/resources` | Publish a new item listing | Yes |
| `PATCH`| `/api/resources/:id` | Update listing details or status | Yes (Owner) |
| `DELETE`| `/api/resources/:id`| Remove an item listing | Yes (Owner) |

### Claim Lifecycle (`/api/claims`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/claims` | Request an available item (publishes `claim.created`) | Yes |
| `GET` | `/api/claims/my` | View all claims made by current user | Yes |
| `GET` | `/api/claims/incoming`| View claims for items owned by current user | Yes |
| `PATCH`| `/api/claims/:id/status`| Approve or reject a claim (publishes status event) | Yes (Owner) |

---

## 📚 Deep Dive Architecture Documentation

For complete technical documentation, architectural diagrams, and grading references:

- 📖 [**DevSecOps & CI/CD Pipeline Deep Dive**](docs/DEVSECOPS_AND_CICD_DEEP_DIVE.md) — Comprehensive guide to Gitleaks, Semgrep, Trivy, and automated AWS deployment.
- 📖 [**Infrastructure as Code (Terraform) Deep Dive**](docs/TERRAFORM_IAC_DEEP_DIVE.md) — AWS VPC, Security Groups, EC2 provisioning, and Cloud-Init bootstrapping.
- 📖 [**Kubernetes & Database Architecture Deep Dive**](docs/K8S_AND_DEPLOYMENT_DEEP_DIVE.md) — Ingress, ConfigMaps, Secrets, HPA autoscaling, and Supabase database-per-service patterns.
- 📖 [**Cloud Native Assignment Evaluation Roadmap**](docs/CLOUD_NATIVE_ASSIGNMENT_ROADMAP.md) — Full 20-mark academic evaluation rubrics and demonstration guide.

---

## 📄 License
Open source under the MIT License.
