# Infrastructure as Code (IaC) with Terraform Deep Dive

This document details the **Infrastructure as Code (IaC)** architecture used to provision the cloud infrastructure for the **reSource** microservices platform on **Amazon Web Services (AWS)**.

---

## 1. Why Infrastructure as Code (IaC)?

Manual server setup via the AWS Web Console is prone to human error, difficult to replicate, impossible to version control, and time-consuming. 

By using **Terraform**, our entire cloud infrastructure is defined as declarative code in [`infra/terraform/`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/infra/terraform/).
- **Repeatability:** Anyone can clone this repository and spin up an identical cloud environment in ~90 seconds.
- **Cost Efficiency:** Running cloud resources 24/7 costs money. With Terraform, you can provision the cluster for testing or a grading presentation and destroy everything immediately afterward with one command (`terraform destroy`).
- **Disaster Recovery:** If an instance becomes corrupted, simply run `terraform apply` to recreate a fresh, healthy node.

---

## 2. Cloud Architecture Provisioned

The Terraform configuration provisions the following AWS resources:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AWS Cloud: ap-south-1                              │
│                                                                             │
│  [ Dedicated VPC: 10.0.0.0/16 ]                                             │
│    │                                                                        │
│    ├── [ Internet Gateway (IGW) ] ◄── Direct Internet Routing               │
│    │                                                                        │
│    └── [ Public Subnet: 10.0.1.0/24 ]                                       │
│          │                                                                  │
│          ├── [ Elastic IP (EIP) ] ── Permanent Static Public IPv4           │
│          │                                                                  │
│          └── [ Security Group: cna-resource-sg ]                            │
│                • Port 22    (SSH Admin)                                     │
│                • Port 80    (HTTP Traefik Ingress)                          │
│                • Port 443   (HTTPS Ingress)                                 │
│                • Port 30000 (API Gateway NodePort)                          │
│                • Port 31672 (RabbitMQ Dashboard NodePort)                   │
│                • Port 6443  (K3s Kubernetes API)                            │
│                • Outbound: All (0.0.0.0/0)                                  │
│                      │                                                      │
│                      ▼                                                      │
│          [ EC2 Instance: cna-resource-k3s-node ]                            │
│          • Type: t3.small (Free Tier) or c7i-flex.large                     │
│          • Disk: 30 GB gp3 SSD                                              │
│          • OS: Ubuntu 22.04 LTS (Jammy AMD64)                               │
│          • Bootstrapped with Cloud-Init (user_data.sh)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Automated Cloud-Init Bootstrapping (`user_data.sh`)

One of the key innovations of this setup is eliminating manual SSH configuration. When the EC2 instance is created, AWS automatically runs [`user_data.sh`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/infra/terraform/user_data.sh) in the background:

### A. 4GB Swap Space Configuration
Free-tier instances (like `t3.small` with 2 GB RAM) risk Out-Of-Memory (OOM) crashes under heavy container loads.  
The bootstrap script automatically configures a **4GB swapfile** on the high-speed gp3 SSD:
```bash
fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10
```
- **Total Virtual Memory:** 2 GB physical RAM + 4 GB swap = **6 GB virtual memory**.
- Guarantees K3s, RabbitMQ, and all 5 microservices run without memory crashes.

### B. Automated Docker & K3s Installation
The script installs Docker Engine, downloads K3s with built-in Traefik Ingress, and waits until the node reports `Ready`:
```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -
```

### C. Developer Convenience Configuration
Sets up `kubeconfig` for the default `ubuntu` user and injects handy aliases into `~/.bashrc`:
- `k` $\rightarrow$ `kubectl`
- `kgp` $\rightarrow$ `kubectl get pods -n resource-app`
- `kgs` $\rightarrow$ `kubectl get svc -n resource-app`
- `kgl` $\rightarrow$ `kubectl logs -n resource-app`

---

## 4. SSH Key Management: Fully Autonomous Lifecycle

A common issue with ephemeral infrastructure is:  
> *"If I destroy Terraform, do I lose my SSH keys and have to re-configure GitHub Secrets?"*

**No.** Terraform handles key management autonomously:
1. If no existing AWS key pair is specified, Terraform's `tls_private_key` resource generates a **4096-bit RSA key pair**.
2. It registers the public key with AWS as `cna-resource-key`.
3. It writes the private key file locally to `infra/terraform/cna-resource-key.pem` with secure `0600` permissions.
4. If you already have your own key pair (e.g., `~/.ssh/cna-deployer.pub`), you can set `public_key_path` in `terraform.tfvars` and Terraform will reuse it across every destroy and recreate cycle!

---

## 5. Terraform Commands Reference

```bash
cd infra/terraform

# 1. Initialize providers (AWS, TLS, Local)
terraform init

# 2. Preview the resources to create
terraform plan

# 3. Create the entire cloud infrastructure
terraform apply -auto-approve

# 4. View outputs anytime (IPs, URLs, SSH command)
terraform output

# 5. Cleanly destroy everything to prevent AWS billing
terraform destroy -auto-approve
```
