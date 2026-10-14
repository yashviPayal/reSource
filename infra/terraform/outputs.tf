output "public_ip" {
  description = "Elastic Public IP address of the EC2 K3s node"
  value       = aws_eip.k8s_eip.public_ip
}

output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.k8s_node.id
}

output "ssh_command" {
  description = "SSH command to connect to the EC2 instance"
  value       = var.key_name != "" ? "ssh -i <your-${var.key_name}.pem> ubuntu@${aws_eip.k8s_eip.public_ip}" : (var.public_key_path != "" ? "ssh -i <your-private-key> ubuntu@${aws_eip.k8s_eip.public_ip}" : "ssh -i cna-resource-key.pem ubuntu@${aws_eip.k8s_eip.public_ip}")
}

output "ssh_private_key_file" {
  description = "Path to the auto-generated private key (copy its content into GitHub Secrets as EC2_SSH_KEY)"
  value       = var.key_name == "" && var.public_key_path == "" ? "${path.module}/cna-resource-key.pem" : "Managed externally"
}

output "api_gateway_ingress_url" {
  description = "Public API Gateway URL via Traefik Ingress (Port 80)"
  value       = "http://${aws_eip.k8s_eip.public_ip}/api"
}

output "api_gateway_nodeport_url" {
  description = "Public API Gateway direct NodePort URL (Port 30000)"
  value       = "http://${aws_eip.k8s_eip.public_ip}:30000/api"
}

output "rabbitmq_dashboard_url" {
  description = "RabbitMQ Management UI URL (Port 31672)"
  value       = "http://${aws_eip.k8s_eip.public_ip}:31672"
}

output "vercel_env_instruction" {
  description = "Value to set in Vercel for VITE_API_URL"
  value       = "VITE_API_URL=http://${aws_eip.k8s_eip.public_ip}/api"
}
