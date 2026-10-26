data "aws_availability_zones" "available" {
  state = "available"
}

module "network" {
  source = "./modules/network"

  project  = var.project
  vpc_cidr = var.vpc_cidr
  az_names = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

module "ecr" {
  source = "./modules/ecr"

  project  = var.project
  services = var.services
}

module "eks" {
  source = "./modules/eks"

  project            = var.project
  cluster_version    = var.cluster_version
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  node_instance_type = var.node_instance_type
  node_desired       = var.node_desired
  node_min           = var.node_min
  node_max           = var.node_max
}

module "data" {
  source = "./modules/data"

  project            = var.project
  vpc_id             = module.network.vpc_id
  vpc_cidr           = var.vpc_cidr
  private_subnet_ids = module.network.private_subnet_ids
  db_username        = var.db_username
  db_password        = var.db_password
  db_instance_class  = var.db_instance_class
  redis_node_type    = var.redis_node_type
}
