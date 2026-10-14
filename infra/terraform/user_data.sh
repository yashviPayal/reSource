#!/bin/bash
set -euo pipefail

# Redirect stdout and stderr to user-data log for easy debugging
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "=== Starting Cloud-Init Automated Node Bootstrapping at $(date) ==="

# 0. Configure 4GB Swap Space (ensures t3.small / c7i-flex never encounters OOM)
echo "=== Configuring 4GB Swap Space ==="
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# 1. Update system packages
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git ca-certificates gnupg lsb-release htop unzip

# 2. Install Docker Engine & Docker Compose
echo "=== Installing Docker ==="
apt-get install -y docker.io docker-compose-v2
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# 3. Install K3s Lightweight Kubernetes (includes Traefik Ingress Controller)
echo "=== Installing K3s ==="
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -

# 4. Wait for K3s node to report Ready state
echo "=== Waiting for K3s node to be Ready ==="
until kubectl get nodes 2>/dev/null | grep -q ' Ready'; do
  echo "Waiting for node readiness..."
  sleep 3
done

# 5. Set up Kubeconfig for the 'ubuntu' default user
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown -R ubuntu:ubuntu /home/ubuntu/.kube
chmod 600 /home/ubuntu/.kube/config

# Add convenient aliases and environment variables to ubuntu's bashrc
cat << 'EOF' >> /home/ubuntu/.bashrc
export KUBECONFIG=/home/ubuntu/.kube/config
alias k=kubectl
alias kgp="kubectl get pods -n resource-app"
alias kgs="kubectl get svc -n resource-app"
alias kgl="kubectl logs -n resource-app"
EOF

echo "=== Automated Node Bootstrapping Finished Successfully at $(date) ==="
