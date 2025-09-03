# SolviumAI Quiz Bot - Production Deployment Guide

This guide covers deploying the SolviumAI Quiz Bot to production using Docker containers with monitoring, logging, and security best practices.

## 🚀 Quick Start

### 1. Prerequisites

- Docker and Docker Compose installed
- Linux server with at least 4GB RAM and 2 CPU cores
- Domain name (for production webhooks)
- SSL certificates (for HTTPS)

### 2. One-Command Deployment

```bash
# Make script executable and run
chmod +x deploy-production.sh
./deploy-production.sh
```

## 📋 Manual Deployment Steps

### Step 1: Environment Setup

```bash
# Copy environment template
cp env.production.example .env

# Edit with your production values
nano .env
```

**Required Environment Variables:**

```bash
# Core
ENVIRONMENT=production
BOT_USERNAME=your_bot_username

# Telegram
TELEGRAM_TOKEN=your_bot_token
WEBHOOK_URL=https://yourdomain.com

# Database (external recommended)
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis (external recommended)
REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_SSL=true
REDIS_PASSWORD=your_password

# API Keys
GOOGLE_GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
SERPER_API_KEY=your_key

# NEAR Blockchain
NEAR_WALLET_PRIVATE_KEY=ed25519:your_key
NEAR_WALLET_ADDRESS=your_wallet.near
WALLET_ENCRYPTION_KEY=your_32_byte_key
```

### Step 2: Deploy Services

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

## 🏗️ Architecture Overview

```
Internet → Nginx (80/443) → FastAPI App (8000) → Services
                    ↓
            Redis + PostgreSQL + Monitoring
```

### Services:

- **quiz-agent**: Main FastAPI application
- **nginx**: Reverse proxy with SSL termination
- **prometheus**: Metrics collection
- **grafana**: Monitoring dashboard

**Note**: PostgreSQL and Redis are configured as external services and are not included in the Docker stack.

## 🔧 Configuration Options

### External Services Configuration

This setup is configured to use external PostgreSQL and Redis services by default. The Docker containers will connect to these external services.

#### External PostgreSQL

```bash
# Set DATABASE_URL to your external PostgreSQL instance
DATABASE_URL=postgresql://username:password@your-external-host:5432/database_name
```

#### External Redis

```bash
# Set Redis environment variables for your external instance
REDIS_HOST=your-external-redis-host
REDIS_PORT=6379
REDIS_SSL=true
REDIS_PASSWORD=your_redis_password
```

**Benefits of External Services:**

- **Managed databases** with automatic backups and updates
- **Better scalability** and performance
- **Reduced maintenance** overhead
- **Professional support** and monitoring
- **Better security** with managed access controls

### SSL Configuration

```bash
# Place your SSL certificates in ssl/ directory
ssl/
├── cert.pem    # Your SSL certificate
└── key.pem     # Your private key

# Or generate self-signed for testing
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"
```

## 📊 Monitoring & Logging

### Access Monitoring

- **Prometheus**: http://your-server:9090
- **Grafana**: http://your-server:3000 (admin/admin)

### View Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f quiz-agent

# Nginx logs
tail -f logs/nginx/access.log
tail -f logs/nginx/error.log
```

### Health Checks

```bash
# Application health
curl http://localhost:8000/health/

# Detailed health
curl http://localhost:8000/health/detailed

# Nginx health
curl http://localhost/health
```

## 🔒 Security Best Practices

### 1. Environment Variables

- Never commit `.env` files to version control
- Use strong, unique passwords
- Rotate API keys regularly

### 2. Network Security

- Only expose necessary ports (80, 443, 8000)
- Use internal Docker networks
- Consider using a firewall

### 3. SSL/TLS

- Use proper SSL certificates (Let's Encrypt)
- Enable HTTPS redirects
- Use strong cipher suites

### 4. Container Security

- Run containers as non-root users
- Keep base images updated
- Scan for vulnerabilities

## 📈 Scaling & Performance

### Resource Limits

```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: "2.0"
    reservations:
      memory: 512M
      cpus: "0.5"
```

### Horizontal Scaling

```bash
# Scale the main application
docker-compose -f docker-compose.production.yml up -d --scale quiz-agent=3

# Use load balancer (nginx) to distribute traffic
```

### Performance Tuning

- Adjust `FASTAPI_WORKERS` based on CPU cores
- Configure Redis memory limits
- Optimize database queries
- Use connection pooling

## 🚨 Troubleshooting

### Common Issues

#### 1. Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs

# Check resource usage
docker stats

# Verify environment variables
docker-compose -f docker-compose.production.yml config
```

#### 2. External Database Connection Issues

```bash
# Test external database connectivity
# Extract host from DATABASE_URL and test connectivity
echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p' | xargs -I {} ping -c 1 {}

# Test database connection (if psql is available)
psql "$DATABASE_URL" -c "SELECT 1;" 2>/dev/null && echo "Database connection successful" || echo "Database connection failed"

# Check application logs for database errors
docker-compose -f docker-compose.production.yml logs quiz-agent | grep -i "database\|postgres\|connection"
```

#### 3. External Redis Connection Issues

```bash
# Test external Redis connectivity
ping -c 1 $REDIS_HOST

# Test Redis connection (if redis-cli is available)
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping 2>/dev/null && echo "Redis connection successful" || echo "Redis connection failed"

# Check application logs for Redis errors
docker-compose -f docker-compose.production.yml logs quiz-agent | grep -i "redis\|connection"
```

#### 4. Health Check Failures

```bash
# Check application status
curl -v http://localhost:8000/health/

# Verify service dependencies
docker-compose -f docker-compose.production.yml ps
```

### Recovery Procedures

#### Restart Services

```bash
# Restart all services
docker-compose -f docker-compose.production.yml restart

# Restart specific service
docker-compose -f docker-compose.production.yml restart quiz-agent
```

#### Complete Redeployment

```bash
# Stop and remove all containers
docker-compose -f docker-compose.production.yml down --volumes

# Rebuild and start
docker-compose -f docker-compose.production.yml up -d --build
```

## 🔄 Updates & Maintenance

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.production.yml up -d --build
```

### Database Migrations

```bash
# Run migrations (if needed)
docker-compose -f docker-compose.production.yml exec quiz-agent python -m alembic upgrade head
```

### Backup Procedures

```bash
# External Database backup (if you have access)
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# External Redis backup (if you have access)
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD BGSAVE

# Application data backup
tar -czf app_backup_$(date +%Y%m%d_%H%M%S).tar.gz logs/ data/

# Note: For managed external services, backups are typically handled automatically
# by the service provider. Check your service dashboard for backup options.
```

## 📞 Support

For deployment issues:

1. Check the logs first
2. Verify environment variables
3. Check service dependencies
4. Review this documentation
5. Check GitHub issues

## 🎯 Next Steps

After successful deployment:

1. Set up monitoring alerts in Grafana
2. Configure log aggregation
3. Set up automated backups
4. Implement CI/CD pipeline
5. Set up SSL certificates
6. Configure domain and DNS
