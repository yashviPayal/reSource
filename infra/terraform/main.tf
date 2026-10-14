# Fetch latest official Ubuntu 22.04 LTS AMI in the configured region
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical official owner ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# SSH Key Pair Management:
# Option 1: User specified key_name (existing in AWS) -> used directly.
# Option 2: User specified public_key_path -> imported as AWS key pair.
# Option 3: Both empty -> Terraform generates 4096-bit RSA key and saves 'cna-resource-key.pem'.
resource "tls_private_key" "ssh" {
  count     = var.key_name == "" && var.public_key_path == "" ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "auth" {
  count      = var.key_name == "" ? 1 : 0
  key_name   = "${var.project_name}-key"
  public_key = var.public_key_path != "" ? file(var.public_key_path) : tls_private_key.ssh[0].public_key_openssh
}

resource "local_file" "private_key_pem" {
  count           = var.key_name == "" && var.public_key_path == "" ? 1 : 0
  content         = tls_private_key.ssh[0].private_key_pem
  filename        = "${path.module}/cna-resource-key.pem"
  file_permission = "0600"
}

# EC2 Instance running Docker + K3s
resource "aws_instance" "k8s_node" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.k8s_node.id]
  key_name                    = var.key_name != "" ? var.key_name : aws_key_pair.auth[0].key_name
  associate_public_ip_address = true

  # Attach automated cloud-init bootstrap script
  user_data = file("${path.module}/user_data.sh")

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true

    tags = {
      Name = "${var.project_name}-root-ebs"
    }
  }

  tags = {
    Name = "${var.project_name}-k3s-node"
    Role = "KubernetesControlPlaneAndWorker"
  }
}

# Allocate Elastic IP for static, permanent public IP address
resource "aws_eip" "k8s_eip" {
  instance = aws_instance.k8s_node.id
  domain   = "vpc"

  depends_on = [aws_internet_gateway.gw]

  tags = {
    Name = "${var.project_name}-eip"
  }
}
