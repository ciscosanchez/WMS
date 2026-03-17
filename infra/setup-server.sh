#!/bin/bash
# Run this once on a fresh Ubuntu 24.04 Hetzner CX22 server
# Usage: ssh root@YOUR_IP 'bash -s' < setup-server.sh
set -euo pipefail

echo "==> Updating system..."
apt-get update && apt-get upgrade -y

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo "==> Installing Docker Compose plugin..."
apt-get install -y docker-compose-plugin

echo "==> Enabling Docker on boot..."
systemctl enable docker
systemctl start docker

echo "==> Creating deploy user..."
useradd -m -s /bin/bash -G docker deploy || true

echo "==> Setting up firewall..."
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Setting up swap (1GB — safety net for 4GB box)..."
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ""
echo "==> Server ready!"
echo "Next steps:"
echo "  1. Copy your SSH key: ssh-copy-id deploy@$(hostname -I | awk '{print $1}')"
echo "  2. Clone repos as 'deploy' user"
echo "  3. Copy .env.prod.example to .env.prod and fill in secrets"
echo "  4. Run: ./deploy.sh"
