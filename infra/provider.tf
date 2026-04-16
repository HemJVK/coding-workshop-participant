provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  s3_use_path_style           = true

  endpoints {
    apigateway     = "http://127.0.0.1:4566"
    cloudformation = "http://127.0.0.1:4566"
    cloudwatch     = "http://127.0.0.1:4566"
    dynamodb       = "http://127.0.0.1:4566"
    ec2            = "http://127.0.0.1:4566"
    es             = "http://127.0.0.1:4566"
    firehose       = "http://127.0.0.1:4566"
    iam            = "http://127.0.0.1:4566"
    kinesis        = "http://127.0.0.1:4566"
    lambda         = "http://127.0.0.1:4566"
    route53        = "http://127.0.0.1:4566"
    redshift       = "http://127.0.0.1:4566"
    s3             = "http://127.0.0.1:4566"
    secretsmanager = "http://127.0.0.1:4566"
    ses            = "http://127.0.0.1:4566"
    sns            = "http://127.0.0.1:4566"
    sqs            = "http://127.0.0.1:4566"
    ssm            = "http://127.0.0.1:4566"
    stepfunctions  = "http://127.0.0.1:4566"
    sts            = "http://127.0.0.1:4566"
  }
}

terraform {
  backend "s3" {
    bucket = "coding-workshop-us-east-1-abcd1234"
    key    = "terraform/terraform.tfstate"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  required_version = ">= 1.11.0"
}
