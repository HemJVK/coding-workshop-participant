#!/usr/bin/env bash
# Script: Generate Frontend Environment Configuration
# Purpose: Generate .env.local file for React frontend with API configuration
# Usage: ./generate-env.sh

set -e

# Usage helper
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0"
    echo "Generate .env.local file for React frontend with API configuration"
    echo ""
    echo "Description:"
    echo "  Retrieves API configuration from Terraform outputs and"
    echo "  generates .env.local file for React development"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Requirements:"
    echo "  - terraform installed"
    echo "  - Backend infrastructure deployed"
    echo ""
    echo "Output:"
    echo "  Creates frontend/.env.local with API configuration"
    exit 0
fi

echo "======================================"
echo "Coding Workshop - Generate Environment"
echo "======================================"
echo ""

# Resolve script directory and project root paths
SCRIPT_DIR="$(cd "$(dirname "$0")" > /dev/null 2>&1 || exit 1; pwd -P)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." > /dev/null 2>&1 || exit 1; pwd -P)"

# Define project directories and output file
FRONTEND_DIR="$PROJECT_ROOT/frontend"
INFRA_DIR="$PROJECT_ROOT/infra"
ENVIRONMENT_CONFIG="$FRONTEND_DIR/.env.local"

# Change to infrastructure directory to retrieve Terraform outputs
cd "$INFRA_DIR"

# Load participant configuration
PARTICIPANT_CONFIG="$PROJECT_ROOT/ENVIRONMENT.config"
if [ -f "$PARTICIPANT_CONFIG" ]; then
    source "$PARTICIPANT_CONFIG"
fi

# Detect environment (local with LocalStack or AWS)
if curl -s http://127.0.0.1:4566/_localstack/health > /dev/null 2>&1; then
    # LocalStack is running — use it
    ENVIRONMENT="local"
    export AWS_ENDPOINT_URL="http://127.0.0.1:4566"
    export AWS_ENDPOINT_URL_S3="http://127.0.0.1:4566"
    export AWS_SQS_PROTOCOL=query
    export AWS_ACCESS_KEY_ID=test
    export AWS_SECRET_ACCESS_KEY=test
    export AWS_REGION=us-east-1
    unset AWS_SESSION_TOKEN
    BUCKET_NAME="coding-workshop-tfstate-${PARTICIPANT_ID:-abcd1234}"
else
    # AWS deployment environment
    ENVIRONMENT="aws"
    BUCKET_NAME="coding-workshop-tfstate-${PARTICIPANT_ID:-abcd1234}"
fi

# Initialize terraform with the correct backend so outputs come from the right state
terraform init -reconfigure -lock=false \
    -backend-config="bucket=$BUCKET_NAME" \
    -backend-config="region=${AWS_REGION:-us-east-1}" \
    -backend-config="endpoints={s3=\"http://127.0.0.1:4566\",sts=\"http://127.0.0.1:4566\",iam=\"http://127.0.0.1:4566\"}" \
    -backend-config="skip_credentials_validation=true" \
    -backend-config="skip_metadata_api_check=true" \
    -backend-config="skip_region_validation=true" \
    -backend-config="use_path_style=true" \
    > /dev/null 2>&1

# Retrieve API base URL from Terraform outputs
ALL_OUTPUTS=$(terraform output -json 2>/dev/null || echo "{}")

# Use Python for robust JSON parsing
API_BASE_URL=$(echo "$ALL_OUTPUTS" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('api_base_url', {}).get('value', ''))")

if [ -z "$ALL_OUTPUTS" ] || [ "$ALL_OUTPUTS" = "{}" ]; then
    echo "WARNING: Could not get outputs from Terraform"
    echo "Make sure infrastructure is deployed first with: ./bin/deploy-backend.sh"
    exit 1
fi

# Handle empty API base URL (valid for local development - uses direct Lambda URLs)
if [ -z "$API_BASE_URL" ]; then
    echo "API Base URL: (empty - using direct Lambda Function URLs via proxy)"
    API_BASE_URL="http://localhost:3001"
else
    echo "API Base URL: $API_BASE_URL"
fi

# Retrieve API endpoints and Lambda URLs from Terraform outputs using Python for precision
export ALL_OUTPUTS
API_ENDPOINTS=$(echo "$ALL_OUTPUTS" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data.get('api_endpoints', {}).get('value', {})))")
LAMBDA_URLS=$(echo "$ALL_OUTPUTS" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data.get('lambda_urls', {}).get('value', {})))")

# Generate .env.local configuration file for React frontend
cat > "$ENVIRONMENT_CONFIG" << EOF
# Auto-generated environment file
# Generated on: $(date)
# Environment: $ENVIRONMENT
REACT_APP_API_URL=$API_BASE_URL
REACT_APP_API_ENDPOINTS='$API_ENDPOINTS'
REACT_APP_LAMBDA_URLS='$LAMBDA_URLS'
VITE_API_URL=$API_BASE_URL
VITE_API_ENDPOINTS='$API_ENDPOINTS'
VITE_LAMBDA_URLS='$LAMBDA_URLS'
EOF

echo ""
echo "Contents:"
cat "$ENVIRONMENT_CONFIG"
echo ""
echo "✓ Created $ENVIRONMENT_CONFIG"
echo ""
