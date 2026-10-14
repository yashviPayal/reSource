# Kubernetes, Docker & Database Architecture Deep Dive

This comprehensive guide answers all questions regarding:
1. Docker Desktop container grouping & how to permanently prevent container merging across projects.
2. Core Kubernetes concepts (Ingress, ConfigMaps, Secrets, HPA, Kustomize) and how they function together.
3. How to push your code to GitHub securely without leaking credentials.
4. How to run Kubernetes locally with a local PostgreSQL database vs. Supabase.
5. How "Database-per-Service" works with Supabase (understanding `/postgres` vs `/resourcedb` vs Schemas).

---

## 1. Why Did Docker Desktop Merge Containers Under `backend`?

### The Root Cause:
In your screenshot, Docker Desktop grouped containers from **two completely different projects** (`reSource` and `checkmywarranty`) under a single folder/group labeled **`backend`**.

Here is why this happened:
- Docker Compose assigns a **Project Name** to every container it creates using the label `com.docker.compose.project`.
- If you run `docker compose up` inside a folder named `backend`, Docker Compose **automatically defaults the project name to the folder name (`backend`)**.
- Because your previous project (`checkmywarranty`) was also launched from a folder named `backend` (or without an explicit project name), Docker Desktop assumed all those containers belong to the **same project** and grouped them together!

### The Permanent Solution:
To make sure every project has its own completely isolated group in Docker Desktop:

1. **Explicit Project Name in `docker-compose.yml`:**
   At the very top of [`backend/docker-compose.yml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/backend/docker-compose.yml), specify:
   ```yaml
   name: cna-resource
   ```
2. **Explicit Project Name in `.env` (Best Practice):**
   Add this single line to `backend/.env`:
   ```env
   COMPOSE_PROJECT_NAME=cna-resource
   ```
3. **Clean Up Old Exited Containers from Docker Desktop:**
   Those old containers in your screenshot (`checkmywarranty-container`, `redisinsight-...`, etc.) are in the `Exited` state. Run:
   ```bash
   # Remove exited containers that are no longer running
   docker container prune -f
   ```
   Now Docker Desktop will create a clean, dedicated group labeled **`cna-resource`** that will never merge with any other project.

---

## 2. Core Kubernetes Concepts Explained Simply

### A. Ingress (The Smart Traffic Cop)
- **What is it?**  
  In Kubernetes, each microservice has a `Service` with an internal private IP (e.g. `10.96.0.12`). Outside users cannot reach internal private IPs.
  - Without Ingress, you would need to assign a separate AWS Public IP or AWS Load Balancer to *every single service* (5 services = 5 Load Balancers = $$$ expensive and messy).
  - **With Ingress**, you have **ONE public entry point on Port 80/443**.
- **How it routes:**
  - `http://<domain-or-IP>/api/*` $\rightarrow$ forwards to `api-gateway`
  - `http://<domain-or-IP>/` $\rightarrow$ forwards to `frontend` (or default backend)
- **Traefik vs. NGINX:** K3s on AWS comes with the **Traefik Ingress controller** built-in. Minikube comes with **NGINX Ingress** (`minikube addons enable ingress`). Both read the exact same Kubernetes `Ingress` manifest!

---

### B. ConfigMaps (Non-Sensitive Configuration)
- **What is it?**  
  A dictionary of key-value pairs stored in the cluster for non-secret variables (port numbers, environment flags, CoreDNS service URLs).
- **Why use it?**  
  It follows the **12-Factor App methodology**. You build your Docker image *once*, and configure it differently in Dev, Staging, or Prod by attaching different ConfigMaps, without rebuilding the image.
- **Example in [`k8s/02-configmaps.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/02-configmaps.yaml):**
  ```yaml
  AUTH_SERVICE_URL: "http://auth-service.resource-app.svc.cluster.local:4002"
  ```
  `api-gateway` reads this variable from the ConfigMap and immediately knows how to find `auth-service` via Kubernetes internal DNS.

---

### C. Secrets (Sensitive Credentials)
- **What is it?**  
  Similar to ConfigMaps, but specifically designed for passwords, database connection strings, JWT keys, and API tokens.
- **How it works:**  
  Kubernetes encrypts or base64-encodes the values and mounts them directly into container environment variables or memory files.

---

### D. HPA (Horizontal Pod Autoscaler)
- **What is it?**  
  An automated controller that continuously monitors resource consumption (CPU & Memory) of your Pods.
- **How it works:**
  In [`k8s/11-hpa.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/11-hpa.yaml):
  ```yaml
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 75
  ```
  1. Under normal conditions, `auth-service` runs **2 pods**.
  2. If 1,000 users attempt to log in simultaneously and average CPU crosses 75%, HPA automatically scales up to **3, 4, 5, or 6 pods**.
  3. When the traffic storm ends, HPA gracefully scales the pods back down to **2 pods** to conserve memory.

---

### E. Kustomize (`kustomization.yaml`)
- **What is it?**  
  Kubernetes' official native configuration manager (built directly into `kubectl`).
- **Why use it?**  
  In a microservices project, you have 10+ YAML files (`00-namespace.yaml`, `01-secrets.yaml`, `02-configmaps.yaml`, etc.).
  - Without Kustomize: You would have to manually run `kubectl apply -f ...` 10 separate times in the exact right order.
  - **With Kustomize:** You run **one single command**:
    ```bash
    kubectl apply -k k8s/
    ```
    Kubernetes reads [`k8s/kustomization.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/kustomization.yaml), merges all resources into one atomic transaction, and applies them seamlessly.

---

### F. How They All Work Together (The Big Picture)

```
                       User Request (Browser / Vercel)
                                     │
                                     ▼
                    [Port 80: Kubernetes Ingress]
                                     │
                                     ▼
                [api-gateway Pod (Port 4000: NodePort 30000)]
                                     │
             ┌───────────────────────┼───────────────────────┐
             ▼                       ▼                       ▼
      [auth-service]          [resource-service]      [claim-service]
     (Port 4002: CoreDNS)    (Port 4001: CoreDNS)    (Port 4003: CoreDNS)
             │                       │                       │
             │ (DB_URL from Secret)  │ (DB_URL from Secret)  │ (Events)
             ▼                       ▼                       ▼
     [PostgreSQL Database]   [PostgreSQL Database]   [RabbitMQ Exchange]
                                                             │
                                                             ▼
                                                    [notification-service]
                                                    (Worker sending emails)
```

---

## 3. How to Push to GitHub Without Leaking Secrets

You rightly pointed out: **Never commit production passwords or API keys to GitHub.**

### The Industry Standard Strategy:
1. **`.gitignore` Protection (Already Configured):**
   In `.gitignore`, we added:
   ```gitignore
   k8s/01-secrets.yaml
   !k8s/01-secrets.example.yaml
   ```
   This means your real [`k8s/01-secrets.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/01-secrets.yaml) stays on your machine and will **NEVER be pushed to GitHub**.

2. **Commit the Template ([`k8s/01-secrets.example.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/01-secrets.example.yaml)):**
   This file has placeholder values (`your_jwt_secret_key_here`, `re_your_api_key_here`). It is safely committed so anyone cloning your repo knows what keys are needed.

3. **How Does the Remote EC2 Server Get the Secrets?**
   There are two clean ways:
   - **Method A (Simple Manual for Assignment):**
     When you SSH into your EC2 instance, copy `01-secrets.example.yaml` to `01-secrets.yaml` and paste your actual keys once:
     ```bash
     cp k8s/01-secrets.example.yaml k8s/01-secrets.yaml
     nano k8s/01-secrets.yaml
     ```
   - **Method B (Automated via GitHub Actions CI/CD):**
     Store your sensitive keys in **GitHub Repo Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions** (e.g. `PROD_DB_URL`, `JWT_SECRET`).  
     Your GitHub Actions workflow generates `01-secrets.yaml` on the fly during deployment and applies it to K8s:
     ```bash
     kubectl create secret generic resource-secrets \
       --from-literal=DATABASE_URL="${{ secrets.PROD_DB_URL }}" \
       --from-literal=JWT_SECRET="${{ secrets.JWT_SECRET }}" \
       -n resource-app --dry-run=client -o yaml | kubectl apply -f -
     ```

---

## 4. How to Run Locally with Local Docker/K8s DB vs. Supabase

To make testing 100% offline and local without needing Supabase:

1. **Local In-Cluster Database Manifest ([`k8s/01-postgres-local.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/01-postgres-local.yaml)):**
   We created a local PostgreSQL deployment and service (`postgres-local.resource-app.svc.cluster.local:5432`).
2. **Simple 1-Line Toggle in [`k8s/01-secrets.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/01-secrets.yaml):**
   ```yaml
   # [OPTION 1: LOCAL IN-CLUSTER POSTGRES] -> Active by default for Minikube
   DATABASE_URL: "postgresql://postgres:postgres@postgres-local.resource-app.svc.cluster.local:5432/postgres"

   # [OPTION 2: MANAGED SUPABASE CLOUD] -> Uncomment when deploying to AWS/Prod
   # DATABASE_URL: "postgresql://postgres.nhsokzojzuzitpgmuouk:ReSource%402911@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```
When you run `kubectl apply -k k8s/` in Minikube, all services will store their data in the **local in-cluster database**, requiring zero internet access or Supabase!

---

## 5. The Supabase "Database-per-Service" Question: `/postgres` vs. `/resourcedb`

> **Question:** *"The URL has `/postgres` at the end. Can I just change it to `/resourcedb` or `/userdb`? Do I have to create separate Supabase projects?"*

### A. Can you just change `/postgres` to `/resourcedb` in the URL?
**NO.** If you simply edit the string to `...:5432/resourcedb`, PostgreSQL will throw an immediate connection error:
```text
FATAL: database "resourcedb" does not exist
```
PostgreSQL requires a database to be created with `CREATE DATABASE resourcedb;` before you can connect to it.

Furthermore, **Supabase's Connection Pooler (PgBouncer / Supavisor on port 5432/6543)** is hardcoded to route pool connections exclusively to the default database named **`postgres`**.

---

### B. How Does "Database-per-Service" Work in Production Without Buying 4 Supabase Projects?

In real-world cloud architectures, there are two standard approaches:

#### Approach 1: PostgreSQL Schemas (The Industry Standard for Supabase)
In PostgreSQL, a single database (e.g. `postgres`) can hold multiple isolated **schemas**.  
Think of a schema as a **sub-folder / namespace inside the database**:
- `auth_schema.users`
- `resource_schema.resources`
- `claim_schema.claims`

Each microservice only queries its own schema:
```text
DATABASE_URL=postgresql://postgres:...@...pooler.supabase.com:5432/postgres?search_path=auth_schema
```
**Benefits:**
- 100% logical data isolation (Service A cannot accidentally read or mutate Service B's tables).
- Runs on **1 single free Supabase project**.
- Fully satisfies the "Database-per-Service" requirement for Cloud Native and CNA academic grading.

#### Approach 2: Multiple Databases on the Same Postgres Instance
Inside the Supabase SQL Editor, you can execute:
```sql
CREATE DATABASE auth_db;
CREATE DATABASE resource_db;
CREATE DATABASE claim_db;
```
However, you must connect to them using the **Direct Session Connection** string, not the pooled proxy.

#### Approach 3: Independent Local DB Containers (What We Built for Dev)
In your local Docker Compose setup (`backend/docker-compose.yml`), each microservice already runs on its own physically separate container:
- `auth-db` (Port `5434`, DB: `auth_db`)
- `resource-db` (Port `5433`, DB: `resource_db`)
- `claim-db` (Port `5435`, DB: `claim_db`)

---

## Summary Checklist

| Task | Status | What To Do |
| :--- | :--- | :--- |
| **Separate Docker Desktop projects** | ✅ Solved | Set `COMPOSE_PROJECT_NAME=cna-resource` in `backend/.env` & run `docker container prune -f`. |
| **Understand K8s concepts** | ✅ Documented | Ingress (routing), ConfigMaps (non-secrets), Secrets (credentials), HPA (autoscaling), Kustomize (1-command apply). |
| **Protect Secrets from Git** | ✅ Configured | `01-secrets.yaml` is gitignored; `01-secrets.example.yaml` is the safe template. |
| **Run locally without Supabase** | ✅ Ready | `01-postgres-local.yaml` is active in `k8s/` for 100% local testing on Minikube. |
| **Supabase DB per service** | ✅ Clarified | Use isolated PostgreSQL schemas (`?search_path=...`) on the free tier, or separate projects in enterprise. |
