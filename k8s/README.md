# Kubernetes (K3s) Deployment Guide for reSource Microservices (Backend)

This directory contains production-ready Kubernetes manifests designed to deploy the **entire backend microservices ecosystem** on **AWS EC2 (running K3s or standard Kubernetes)**.

The frontend is deployed on **Vercel** and communicates with this backend via the Ingress / API Gateway endpoint (`http://<EC2-PUBLIC-IP>/api`).

---

## 📁 Manifest Files Overview

| File | Type | Description |
| :--- | :--- | :--- |
| [`00-namespace.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/00-namespace.yaml) | `Namespace` | Creates isolated `resource-app` namespace |
| [`01-secrets.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/01-secrets.yaml) | `Secret` | Stores database credentials, JWT secret, Resend key |
| [`02-configmaps.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/02-configmaps.yaml) | `ConfigMap` | Non-sensitive configs & CoreDNS microservice URLs |
| [`03-rabbitmq.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/03-rabbitmq.yaml) | `Deployment`, `Service` | RabbitMQ broker (AMQP 5672 + UI NodePort 31672) |
| [`04-auth-service.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/04-auth-service.yaml) | `Deployment`, `Service` | Auth Service (2 replicas, probes, resource limits) |
| [`05-resource-service.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/05-resource-service.yaml) | `Deployment`, `Service` | Resource Catalog Service (2 replicas) |
| [`06-claim-service.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/06-claim-service.yaml) | `Deployment`, `Service` | Claim Service (2 replicas, RabbitMQ event publisher) |
| [`07-notification-service.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/07-notification-service.yaml) | `Deployment`, `Service` | Async Email Notification Worker & Resend Dispatcher |
| [`08-api-gateway.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/08-api-gateway.yaml) | `Deployment`, `Service` | Reverse Proxy API Gateway (NodePort 30000) |
| [`10-ingress.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/10-ingress.yaml) | `Ingress` | Routes all incoming Port 80 backend traffic to API Gateway |
| [`11-hpa.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/11-hpa.yaml) | `HorizontalPodAutoscaler` | Autoscales Auth & Resource pods dynamically (2 to 6) |
| [`kustomization.yaml`](file:///media/rohit/D/1_CODING_NIRMA/Sem_7/Assignments/CNA/reSource/k8s/kustomization.yaml) | `Kustomization` | Enables 1-command deployment via `kubectl apply -k k8s/` |

---

## 🚀 Step-by-Step EC2 Deployment (with K3s)

### Step 1: Launch an EC2 Instance on AWS
- **AMI:** Ubuntu 22.04 LTS or 24.04 LTS (64-bit x86)
- **Instance Type:** `t3.medium` (2 vCPU, 4 GB RAM) or `t3.small`
- **Security Group Inbound Rules:**
  - `SSH` (Port 22) from your IP
  - `HTTP` (Port 80) from Anywhere (`0.0.0.0/0`)
  - `Custom TCP` (Port 30000 - API Gateway direct) from Anywhere
  - `Custom TCP` (Port 31672 - RabbitMQ Dashboard) from Anywhere

### Step 2: Install K3s on your EC2 Instance
SSH into your EC2 instance and run:
```bash
# Install lightweight certified Kubernetes (takes ~30 seconds)
curl -sfL https://get.k3s.io | sh -

# Allow running kubectl without sudo
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Verify node is Ready
kubectl get nodes
```

### Step 3: Build or Import Container Images
If you built the images on the EC2 instance using Docker:
```bash
# For K3s (on AWS EC2):
docker save cna-resource-auth-service:latest | sudo k3s ctr images import -
docker save cna-resource-resource-service:latest | sudo k3s ctr images import -
docker save cna-resource-claim-service:latest | sudo k3s ctr images import -
docker save cna-resource-notification-service:latest | sudo k3s ctr images import -
docker save cna-resource-api-gateway:latest | sudo k3s ctr images import -

# For Minikube (local machine):
minikube image load cna-resource-auth-service:latest
minikube image load cna-resource-resource-service:latest
minikube image load cna-resource-claim-service:latest
minikube image load cna-resource-notification-service:latest
minikube image load cna-resource-api-gateway:latest
```
*(Or if you push to Docker Hub, simply update the image names to `<your-dockerhub-username>/<image-name>:latest` in the manifests).*

### Step 4: Deploy All Backend Microservices in 1 Command
```bash
# Clone the repository on EC2 and run:
kubectl apply -k k8s/
```

### Step 5: Verify Deployment Status
```bash
# Check all Pods in the namespace
kubectl get pods -n resource-app -o wide

# Check all Services
kubectl get svc -n resource-app

# Check Ingress
kubectl get ingress -n resource-app
```

---

## 🔗 Connecting Your Vercel Frontend

In your Vercel Project Dashboard:
1. Go to **Settings** $\rightarrow$ **Environment Variables**.
2. Set `VITE_API_URL` to:
   ```env
   VITE_API_URL=http://<EC2-PUBLIC-IP>/api
   ```
   *(Or if you use direct NodePort: `http://<EC2-PUBLIC-IP>:30000/api`)*
3. Trigger a redeploy on Vercel.

---

## 🎯 Proving Microservices & Autoscaling (For College Evaluation)

During your viva or project presentation, run these commands to showcase real cloud-native autoscaling:

```bash
# 1. View all running pods (Notice Auth Service has 2 replicas)
kubectl get pods -n resource-app

# 2. Scale ONLY Auth Service to 5 replicas independently
kubectl scale deployment auth-service --replicas=5 -n resource-app

# 3. Watch pods scale in real time:
kubectl get pods -n resource-app -l app=auth-service

# 4. Check that Resource Service, Claim Service, and Gateway remained unchanged!
kubectl get pods -n resource-app
```

---

## 🌐 Endpoints Summary

- **API Gateway (via Port 80 Ingress):** `http://<EC2-PUBLIC-IP>/api`
- **Health Check:** `http://<EC2-PUBLIC-IP>/health`
- **API Gateway Direct (NodePort):** `http://<EC2-PUBLIC-IP>:30000/health`
- **RabbitMQ Dashboard:** `http://<EC2-PUBLIC-IP>:31672` (Login: `guest` / `guest`)
