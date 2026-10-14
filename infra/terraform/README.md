# Infrastructure as Code (IaC) - AWS EC2 & K3s Cluster

This directory contains Terraform code to automatically provision the cloud infrastructure for the **reSource** microservices platform on AWS.

## Architecture Provisioned

- **VPC:** Dedicated VPC (`10.0.0.0/16`) with DNS support & hostnames.
- **Subnet:** Public Subnet (`10.0.1.0/24`) with automatic public IP mapping.
- **Internet Gateway & Route Table:** Direct routing for inbound/outbound internet traffic.
- **Security Group:**
  - `Port 22`: SSH administration
  - `Port 80`: Public HTTP (Traefik Ingress)
  - `Port 443`: Public HTTPS
  - `Port 30000`: Direct API Gateway NodePort
  - `Port 31672`: RabbitMQ Management Dashboard NodePort
  - `Port 6443`: K3s Kubernetes API Server
- **EC2 Instance:** Ubuntu 22.04 LTS (`t3.medium`, 30 GB gp3 SSD).
- **Elastic IP (EIP):** Static public IPv4 that remains unchanged across reboots.
- **Automated Bootstrapping (`user_data.sh`):**
  - Installs Docker & Docker Compose v2.
  - Installs K3s lightweight Kubernetes with built-in Traefik Ingress.
  - Pre-configures `kubectl` permissions for the `ubuntu` user with aliases (`k`, `kgp`, `kgs`, `kgl`).

---

## 🚀 How to Deploy in 3 Commands

### Step 1: Configure AWS Credentials
Ensure your AWS CLI is configured with credentials that have EC2, VPC, and EIP permissions:
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region (e.g., ap-south-1)
```

### Step 2: Initialize & Review Plan
```bash
cd infra/terraform

# Initialize Terraform (installs AWS provider)
terraform init

# Review resources to be created (1 VPC, 1 Subnet, 1 IGW, 1 Route Table, 1 SG, 1 EC2, 1 EIP)
terraform plan
```

*(Optional)* Create a `terraform.tfvars` from the template if you have an existing SSH key pair:
```bash
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars # set key_name = "your-key-name"
```

### Step 3: Apply & Provision
```bash
terraform apply -auto-approve
```
After ~60–90 seconds, Terraform will output:
- **`public_ip`**: Your static EC2 public IP.
- **`ssh_command`**: Ready-to-copy SSH connection command.
- **`api_gateway_ingress_url`**: `http://<public-ip>/api` (use this in your Vercel frontend!).
- **`rabbitmq_dashboard_url`**: `http://<public-ip>:31672` (RabbitMQ UI).

---

## 🧹 How to Destroy to Avoid AWS Charges
When your college demo is finished and you want to stop incurring AWS charges:
```bash
terraform destroy -auto-approve
```
Everything (EC2, Elastic IP, Security Group, VPC) will be cleanly terminated.

When you run `terraform apply` next time, **EC2's `user_data.sh` will automatically re-install Docker, K3s, and configure everything from scratch with zero manual work.**
