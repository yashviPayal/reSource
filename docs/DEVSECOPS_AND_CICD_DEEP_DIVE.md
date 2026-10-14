# DevSecOps & CI/CD Pipeline Deep Dive

This document provides an in-depth architectural guide to the **DevSecOps** (Development, Security, and Operations) and **Continuous Integration / Continuous Deployment (CI/CD)** pipelines implemented in the **reSource** microservices platform.

---

## 1. What is DevSecOps & The "Shift-Left" Philosophy?

Traditional software delivery models treated security as an afterthought—auditing systems only at the very end of development or after deploying to production. 

**DevSecOps** integrates security controls directly into the developer workflow. In this project, we implement the **"Shift-Left"** model: every git commit and pull request is automatically tested, scanned for secrets, audited for dependency vulnerabilities, and analyzed for container flaws **before** any code can touch the production Kubernetes cluster.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               DEVSECOPS PIPELINE GATES                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
 [Developer Commit] 
         │
         ▼
 1. SECRETS SCANNING   ──► Gitleaks (scans commit history for leaked credentials)
         │
         ▼
 2. SAST ANALYSIS      ──► Semgrep (scans JavaScript code against OWASP Top 10)
         │
         ▼
 3. DEPENDENCY AUDIT   ──► npm audit (checks all microservice packages for CVEs)
         │
         ▼
 4. UNIT TESTING       ──► Node.js Native Runner (runs test suites for all 5 services)
         │
         ▼
 5. CONTAINER SCANNING ──► Aqua Trivy (scans built Docker images for OS-level CVEs)
         │
         ▼
 6. GATED DEPLOYMENT   ──► Triggers ONLY if all security stages pass 100% green
```

---

## 2. DevSecOps Security Stages Explained

All security scans in this repository run **100% free and native inside GitHub Actions runners** without requiring third-party subscriptions or paid API tokens.

### Stage 1: Secrets Detection (Gitleaks)
- **Tool:** `gitleaks/gitleaks-action@v2`
- **Discipline:** Secret Leak Prevention
- **What it catches:** Accidentally committed AWS Access Keys, JWT secret strings, Database connection passwords, Resend tokens, and SSH private keys.
- **How it runs:** Gitleaks scans git diffs and historical commits with regular expressions and entropy algorithms. If a developer accidentally commits a real API key, the build immediately flags the finding.

### Stage 2: Static Application Security Testing (SAST - Semgrep)
- **Tool:** `returntocorp/semgrep:latest`
- **Discipline:** Code Security & Vulnerability Analysis
- **What it catches:**
  - SQL Injection vulnerabilities
  - Cross-Site Scripting (XSS) risks
  - Insecure HTTP headers / Missing security middleware
  - Path traversal vulnerabilities
  - Insecure cookie configurations
- **Rulesets Used:** `p/security-audit` and `p/owasp-top-ten`.

### Stage 3: Software Composition Analysis (SCA - npm audit)
- **Tool:** Native Node.js `npm audit --audit-level=high`
- **Discipline:** Open Source Dependency Security
- **What it catches:** Known vulnerabilities (CVEs) in third-party libraries (e.g., Express, bcryptjs, amqplib, pg) documented in the GitHub Advisory Database.
- **Coverage:** Runs across the frontend and all 5 backend microservice directories simultaneously using a GitHub Actions matrix strategy.

### Stage 4: Automated Unit Testing
- **Tool:** Node.js native test runner (`node --test`)
- **Discipline:** Code Reliability & Functional Correctness
- **Coverage:**
  - `api-gateway`: Route configuration defaults, proxy mappings.
  - `auth-service`: JWT token generation, expiration, bcrypt password hashing.
  - `resource-service`: Listing validation, category/action constraints, JWT verification.
  - `claim-service`: Claim state transitions (pending $\rightarrow$ approved/rejected), auth payload.
  - `notification-service`: RabbitMQ event listener bindings, Resend email fallback simulation.

### Stage 5: Container Vulnerability Scanning (Aqua Security Trivy)
- **Tool:** `aquasecurity/trivy-action@master`
- **Discipline:** Container & OS-level Security
- **What it catches:**
  - Vulnerabilities in base operating system packages (e.g., Alpine Linux, Debian libraries).
  - Outdated runtime packages (e.g., OpenSSL, glibc, curl).
- **Execution:** Each microservice Docker image is built locally inside the GitHub Actions runner and scanned against the National Vulnerability Database (NVD) for `HIGH` and `CRITICAL` severity issues.

---

## 3. Continuous Deployment (CD) Pipeline to AWS K3s

The deployment pipeline in [`.github/workflows/deploy-aws.yml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/.github/workflows/deploy-aws.yml) features two critical production-grade mechanisms:

### A. The Security Gate (`workflow_run`)
Deployments are strictly gated behind the CI pipeline:
```yaml
on:
  workflow_run:
    workflows: ["CI & DevSecOps Pipeline"]
    types: [completed]
    branches: [main, master, microservices]

jobs:
  deploy-to-k3s:
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success') }}
```
- If any test fails, or if a credential leak is detected in CI, `conclusion == 'success'` evaluates to `false`.
- **The deployment job is automatically aborted.** Vulnerable or broken code is blocked from reaching the AWS EC2 server.

### B. Dynamic EC2 IP Auto-Discovery
To ensure that deployments remain **100% autonomous** even after running `terraform destroy` and `terraform apply`:
- GitHub Actions dynamically queries the AWS EC2 API:
  ```bash
  DISCOVERED_IP=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=cna-resource-k3s-node" "Name=instance-state-name,Values=running" \
    --query "Reservations[0].Instances[0].PublicIpAddress" --output text)
  ```
- You never have to manually update `EC2_HOST` in GitHub Secrets when recreating infrastructure!

### C. In-Memory Kubernetes Secret Injection
To avoid storing sensitive production passwords in plain text files:
- GitHub Actions SSHs into the EC2 instance and injects secrets directly from GitHub Secrets into Kubernetes memory:
  ```bash
  kubectl create secret generic resource-secrets \
    --from-literal=DATABASE_URL="${{ secrets.DATABASE_URL }}" \
    --from-literal=JWT_SECRET="${{ secrets.JWT_SECRET }}" \
    --from-literal=RESEND_API_KEY="${{ secrets.RESEND_API_KEY }}" \
    -n resource-app --dry-run=client -o yaml | kubectl apply -f -
  ```

### D. Zero-Downtime Rolling Update
Once new container images are imported into K3s containerd, GitHub Actions triggers a rolling restart:
```bash
kubectl rollout restart deployment -n resource-app
kubectl rollout status deployment/api-gateway -n resource-app --timeout=90s
```
Kubernetes starts new healthy pods before terminating old ones, ensuring zero downtime for users.
