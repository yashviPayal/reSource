variable "aws_region" {
  description = "AWS region for provisioning resources"
  type        = string
  default     = "ap-south-1" # Mumbai (closest and lowest latency in India)
}

variable "project_name" {
  description = "Base project name used for resource naming tags"
  type        = string
  default     = "cna-resource"
}

variable "environment" {
  description = "Target deployment environment"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance size. Free-tier options from console: 't3.small' (2GB RAM + 4GB swap) or 'c7i-flex.large' (4GB RAM)"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "Existing AWS EC2 Key Pair name in AWS (leave empty to let Terraform create one)"
  type        = string
  default     = ""
}

variable "public_key_path" {
  description = "Path to a local public key (e.g. ~/.ssh/id_rsa.pub). If empty and key_name is empty, Terraform auto-generates a new 4096-bit RSA key"
  type        = string
  default     = ""
}

variable "root_volume_size" {
  description = "Size of root EBS disk in GB (Docker images + K3s need at least 20-30 GB)"
  type        = number
  default     = 30
}
