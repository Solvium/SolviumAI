#!/bin/bash

# SolviumAI Quiz Bot - Production Deployment Script
# This script deploys the application to production using Docker Compose

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check for both docker-compose (standalone) and docker compose (built-in)
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not available. Please ensure Docker is installed with compose support."
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi

    print_success "All prerequisites are satisfied"
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment..."

    # Check if .env file exists
    if [ ! -f .env ]; then
        print_error ".env file not found. Please create a .env file with your configuration."
        exit 1
    fi

    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        print_success "Environment variables loaded"
    else
        print_error "Failed to load environment variables"
        exit 1
    fi
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment configuration..."

    local required_vars=(
        "TELEGRAM_TOKEN"
        "GOOGLE_GEMINI_API_KEY"
        "NEAR_WALLET_PRIVATE_KEY"
        "NEAR_WALLET_ADDRESS"
        "WALLET_ENCRYPTION_KEY"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi

    print_success "Environment validation passed"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."

    mkdir -p logs/nginx
    mkdir -p data
    mkdir -p ssl
    mkdir -p monitoring/grafana/dashboards
    mkdir -p monitoring/grafana/datasources
    mkdir -p init-scripts

    print_success "Directories created"
}

# Function to generate SSL certificates (self-signed for testing)
generate_ssl_certificates() {
    print_status "Generating SSL certificates..."

    if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
        print_warning "SSL certificates not found. Generating self-signed certificates..."

        # Create self-signed certificate
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem \
            -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

        print_success "Self-signed SSL certificates generated"
        print_warning "For production, replace these with proper SSL certificates"
    else
        print_success "SSL certificates already exist"
    fi
}

# Function to deploy application
deploy_application() {
    print_status "Deploying application..."

        # Stop existing containers
    docker compose -f docker-compose.production.yml down --remove-orphans

    # Build and start services
    docker compose -f docker-compose.production.yml up -d --build

    print_success "Application deployment initiated"
}

# Function to wait for services
wait_for_services() {
    print_status "Waiting for services to be ready..."

    local max_attempts=30
    local attempt=1

        while [ $attempt -le $max_attempts ]; do
        if docker compose -f docker-compose.production.yml ps | grep -q "Up"; then
            print_success "Services are running"
            break
        fi

        print_status "Waiting for services... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        print_error "Services failed to start within expected time"
        docker compose -f docker-compose.production.yml logs
        exit 1
    fi
}

# Function to check health
check_health() {
    print_status "Checking application health..."

    # Wait a bit for services to fully initialize
    sleep 30

    # Check main application
    if curl -f http://localhost:8000/health >/dev/null 2>&1; then
        print_success "Main application is healthy"
    else
        print_warning "Main application health check failed"
    fi

    # Check nginx
    if curl -f http://localhost/health >/dev/null 2>&1; then
        print_success "Nginx is healthy"
    else
        print_warning "Nginx health check failed"
    fi

    # Check external database connection (if possible)
    if command_exists psql && [ -n "$DATABASE_URL" ]; then
        # Extract host from DATABASE_URL for basic connectivity test
        db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
        if [ -n "$db_host" ] && ping -c 1 "$db_host" >/dev/null 2>&1; then
            print_success "External PostgreSQL host is reachable"
        else
            print_warning "External PostgreSQL host connectivity check failed"
        fi
    else
        print_status "External PostgreSQL: Using provided DATABASE_URL"
    fi
}

# Function to show status
show_status() {
    print_status "Application status:"
    docker compose -f docker-compose.production.yml ps

    print_status "Service logs (last 20 lines):"
    docker compose -f docker-compose.production.yml logs --tail=20
}

# Function to show access information
show_access_info() {
    print_success "Deployment completed successfully!"
    echo
    echo "Access Information:"
    echo "=================="
    echo "Main Application: http://localhost:8000"
    echo "Nginx Proxy: http://localhost (HTTP), https://localhost (HTTPS)"
    echo "Prometheus: http://localhost:9090"
    echo "Grafana: http://localhost:3000 (admin/admin)"
    echo
    echo "Useful Commands:"
    echo "==============="
    echo "View logs: docker compose -f docker-compose.production.yml logs -f"
    echo "Stop services: docker compose -f docker-compose.production.yml down"
    echo "Restart services: docker compose -f docker-compose.production.yml restart"
    echo "Update and redeploy: ./deploy-production.sh"
}

# Main execution
main() {
    echo "=========================================="
    echo "SolviumAI Quiz Bot - Production Deployment"
    echo "=========================================="
    echo

    check_prerequisites
    setup_environment
    validate_environment
    create_directories
    generate_ssl_certificates
    deploy_application
    wait_for_services
    check_health
    show_status
    show_access_info
}

# Run main function
main "$@"
