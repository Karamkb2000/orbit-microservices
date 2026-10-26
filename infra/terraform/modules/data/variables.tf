variable "project" { type = string }
variable "vpc_id" { type = string }
variable "vpc_cidr" { type = string }
variable "private_subnet_ids" { type = list(string) }

variable "db_username" { type = string }

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_instance_class" { type = string }
variable "redis_node_type" { type = string }
