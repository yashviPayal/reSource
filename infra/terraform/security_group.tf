resource "aws_security_group" "k8s_node" {
  name        = "${var.project_name}-sg"
  description = "Security group for ReSource K3s Kubernetes Single-Node cluster"
  vpc_id      = aws_vpc.main.id

  # SSH Access
  ingress {
    description = "SSH administrative access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP Ingress (Port 80)
  ingress {
    description = "Public HTTP traffic routed via Traefik Ingress to API Gateway"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS Ingress (Port 443)
  ingress {
    description = "Public HTTPS traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # API Gateway Direct NodePort (Port 30000)
  ingress {
    description = "Direct NodePort for API Gateway"
    from_port   = 30000
    to_port     = 30000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # RabbitMQ Management Dashboard NodePort (Port 31672)
  ingress {
    description = "RabbitMQ Management UI NodePort for professor demo and queue inspection"
    from_port   = 31672
    to_port     = 31672
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # K3s Kubernetes API Server (Port 6443)
  ingress {
    description = "K3s Kubernetes API Server (optional remote kubectl access)"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic to internet (for apt, docker hub, resend, supabase)
  egress {
    description = "Allow all outbound internet traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}
