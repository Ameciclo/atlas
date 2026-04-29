# Turborepo Remote Cache Implementation Guide

## 🎯 Overview

Turborepo remote cache allows sharing build artifacts across team members and CI/CD environments, dramatically reducing build times by avoiding redundant work.

## 📊 Expected Benefits

- **50-80% build time reduction** for unchanged code
- **Shared cache** across team members and CI
- **Incremental builds** that scale with team size
- **Cost savings** on CI/CD compute resources

## 🔄 Implementation Options

### Option 1: Vercel Remote Cache (Recommended)
**Pros**: Official support, zero maintenance, generous free tier  
**Cons**: Vendor lock-in, data stored on Vercel  
**Cost**: Free for open source, $20/month for teams  

### Option 2: Self-Hosted Remote Cache
**Pros**: Full control, data sovereignty, cost-effective at scale  
**Cons**: Maintenance overhead, initial setup complexity  
**Cost**: Infrastructure costs only (~$10-50/month)  

### Option 3: GitHub Actions Cache (Current)
**Pros**: No additional cost, simple setup  
**Cons**: Limited to 10GB, not shared across repos, slower  
**Cost**: Free  

## 🚀 Option 1: Vercel Remote Cache Setup

### Step 1: Create Vercel Account and Team
- [ ] Sign up at [vercel.com](https://vercel.com)
- [ ] Create a team for Atlas project
- [ ] Get team ID from dashboard

### Step 2: Generate Access Token
- [ ] Go to Vercel Dashboard → Settings → Tokens
- [ ] Create new token with scope: `read:cache`, `write:cache`
- [ ] Copy token securely

### Step 3: Configure Repository
- [ ] Add GitHub secrets:
  ```bash
  TURBO_TOKEN=<your-vercel-token>
  TURBO_TEAM=<your-team-id>
  ```

### Step 4: Update turbo.json
- [ ] Add remote cache configuration:
  ```json
  {
    "remoteCache": {
      "signature": true
    }
  }
  ```

### Step 5: Update CI/CD Workflows
- [ ] Add environment variables to GitHub Actions:
  ```yaml
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
  ```

### Step 6: Test and Validate
- [ ] Run builds locally with cache
- [ ] Verify cache hits in CI
- [ ] Monitor cache usage in Vercel dashboard

## 🏗️ Option 2: Self-Hosted Remote Cache (ducktors/turborepo-remote-cache)

### **🎯 Recommended Solution: ducktors/turborepo-remote-cache**

The [ducktors/turborepo-remote-cache](https://github.com/ducktors/turborepo-remote-cache) is a **production-ready, open-source implementation** of the Turborepo custom remote cache server. This is the **best self-hosted option** available.

### **✨ Why This Solution is Superior**

✅ **Production-ready**: Used by many companies in production
✅ **Multiple storage backends**: Local, S3, Google Cloud, Azure, Redis
✅ **Docker support**: Ready-to-deploy containers
✅ **One-click deployments**: Deploy buttons for major platforms
✅ **Active maintenance**: 1.3k+ stars, 36+ contributors
✅ **Security focused**: OpenSSF Scorecard compliant
✅ **Comprehensive docs**: Full documentation and examples

### **🚀 Quick Deployment Options**

#### **Option A: Docker (Recommended)**
```bash
# Pull the official Docker image
docker pull ducktors/turborepo-remote-cache:latest

# Run with local storage
docker run -p 3000:3000 \
  -e TURBO_TOKEN=your-secret-token \
  -e STORAGE_PROVIDER=local \
  -e STORAGE_PATH=/cache \
  -v ./cache:/cache \
  ducktors/turborepo-remote-cache:latest
```

#### **Option B: Docker Compose**
```yaml
# docker-compose.yml
version: '3.8'
services:
  turbo-cache:
    image: ducktors/turborepo-remote-cache:latest
    ports:
      - "3000:3000"
    environment:
      - TURBO_TOKEN=your-secret-token
      - STORAGE_PROVIDER=local
      - STORAGE_PATH=/cache
    volumes:
      - ./cache:/cache
    restart: unless-stopped
```

#### **Option C: One-Click Cloud Deployments**
- **Railway**: [Deploy to Railway](https://railway.app/template/turborepo-remote-cache)
- **Render**: [Deploy to Render](https://render.com/deploy?repo=https://github.com/ducktors/turborepo-remote-cache)
- **DigitalOcean**: [Deploy to DigitalOcean](https://cloud.digitalocean.com/apps/new?repo=https://github.com/ducktors/turborepo-remote-cache/tree/main)

### **🔧 Storage Provider Options**

#### **Local Storage (Simplest)**
```bash
STORAGE_PROVIDER=local
STORAGE_PATH=/cache
```

#### **AWS S3**
```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=my-turbo-cache
STORAGE_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

#### **Google Cloud Storage**
```bash
STORAGE_PROVIDER=google-cloud-storage
STORAGE_GCS_BUCKET=my-turbo-cache
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

#### **Azure Blob Storage**
```bash
STORAGE_PROVIDER=azure-blob-storage
STORAGE_AZURE_CONTAINER=turbo-cache
AZURE_STORAGE_ACCOUNT=myaccount
AZURE_STORAGE_ACCESS_KEY=your-key
```

#### **Redis (High Performance)**
```bash
STORAGE_PROVIDER=redis
STORAGE_REDIS_URL=redis://localhost:6379
```

### **📋 Implementation Steps**

#### **Step 1: Choose Deployment Method**
- [ ] **Docker**: For simple local or VPS deployment
- [ ] **Cloud Platform**: For managed deployment with scaling
- [ ] **Kubernetes**: For enterprise container orchestration

#### **Step 2: Configure Storage Backend**
- [ ] **Local**: For single-server setups
- [ ] **S3/GCS/Azure**: For scalable cloud storage
- [ ] **Redis**: For high-performance caching

#### **Step 3: Deploy the Server**
```bash
# Example: Docker deployment with S3 storage
docker run -d \
  --name turbo-cache \
  -p 3000:3000 \
  -e TURBO_TOKEN=your-secret-token \
  -e STORAGE_PROVIDER=s3 \
  -e STORAGE_S3_BUCKET=my-turbo-cache \
  -e STORAGE_S3_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID=your-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret \
  ducktors/turborepo-remote-cache:latest
```

#### **Step 4: Configure SSL and Domain (Production)**
- [ ] Set up reverse proxy (nginx, Traefik, or cloud load balancer)
- [ ] Configure SSL/TLS certificates (Let's Encrypt recommended)
- [ ] Point domain to your cache server (e.g., `turbo-cache.yourdomain.com`)

#### **Step 5: Configure Turborepo**
- [ ] Update turbo.json:
  ```json
  {
    "remoteCache": {
      "signature": true
    }
  }
  ```

- [ ] Set environment variables:
  ```bash
  TURBO_API=https://turbo-cache.yourdomain.com
  TURBO_TOKEN=your-secret-token
  ```

#### **Step 6: Security and Monitoring**
- [ ] Use strong authentication tokens (generate with `openssl rand -hex 32`)
- [ ] Set up monitoring (the server provides `/health` endpoint)
- [ ] Configure log aggregation and alerting
- [ ] Implement backup strategy for cache data
- [ ] Set up cache cleanup policies (automatic in ducktors implementation)

### **💰 Infrastructure Requirements & Costs**

#### **Minimum Setup (Small Team)**
- **CPU**: 1-2 cores
- **RAM**: 1-2 GB
- **Storage**: 20-50 GB SSD (or cloud storage)
- **Network**: 1 Gbps
- **Cost**: ~$5-15/month (VPS) + storage costs

#### **Production Setup (Large Team)**
- **CPU**: 2-4 cores
- **RAM**: 4-8 GB
- **Storage**: 100-500 GB SSD (or cloud storage)
- **Network**: 10 Gbps
- **Redundancy**: Load balancer + multiple instances
- **Cost**: ~$20-50/month (compute) + storage costs

#### **Cloud Storage Costs (Approximate)**
- **AWS S3**: ~$0.023/GB/month + transfer costs
- **Google Cloud**: ~$0.020/GB/month + transfer costs
- **Azure Blob**: ~$0.018/GB/month + transfer costs
- **Local Storage**: One-time hardware cost

## 🛠️ **Complete Implementation Example**

### **Production-Ready Setup with Docker Compose + S3**

#### **1. Create docker-compose.yml**
```yaml
version: '3.8'
services:
  turbo-cache:
    image: ducktors/turborepo-remote-cache:latest
    container_name: turbo-cache
    ports:
      - "3000:3000"
    environment:
      # Authentication
      - TURBO_TOKEN=${TURBO_TOKEN}

      # Storage Configuration (S3)
      - STORAGE_PROVIDER=s3
      - STORAGE_S3_BUCKET=${S3_BUCKET}
      - STORAGE_S3_REGION=${S3_REGION}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}

      # Optional: Logging
      - LOG_LEVEL=info

      # Optional: Cache settings
      - CACHE_MAX_SIZE=10GB

    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: nginx reverse proxy with SSL
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - turbo-cache
    restart: unless-stopped
```

#### **2. Create .env file**
```bash
# Generate a secure token
TURBO_TOKEN=your-super-secret-token-here

# S3 Configuration
S3_BUCKET=my-company-turbo-cache
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
```

#### **3. Create nginx.conf (Optional SSL Termination)**
```nginx
events {
    worker_connections 1024;
}

http {
    upstream turbo-cache {
        server turbo-cache:3000;
    }

    server {
        listen 80;
        server_name turbo-cache.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name turbo-cache.yourdomain.com;

        ssl_certificate /etc/ssl/certs/fullchain.pem;
        ssl_certificate_key /etc/ssl/certs/privkey.pem;

        location / {
            proxy_pass http://turbo-cache;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

#### **4. Deploy and Test**
```bash
# Start the services
docker-compose up -d

# Check health
curl http://localhost:3000/health

# Test with SSL (if configured)
curl https://turbo-cache.yourdomain.com/health
```

## 📋 Implementation Checklist

### **Pre-Implementation**
- [ ] Analyze current build times and cache hit potential
- [ ] Choose storage backend (local vs cloud storage)
- [ ] Estimate costs (compute + storage)
- [ ] Plan deployment strategy (Docker, cloud platform, etc.)
- [ ] Generate secure authentication tokens

### **Implementation Phase**
- [ ] Deploy ducktors/turborepo-remote-cache server
- [ ] Configure chosen storage backend
- [ ] Set up SSL/TLS and domain (for production)
- [ ] Update turbo.json configuration
- [ ] Configure CI/CD environment variables
- [ ] Test cache functionality locally
- [ ] Deploy to CI/CD pipeline
- [ ] Monitor cache hit rates

### **Post-Implementation**
- [ ] Monitor build time improvements
- [ ] Track cache hit/miss ratios
- [ ] Set up monitoring and alerting
- [ ] Optimize cache configuration
- [ ] Document usage for team
- [ ] Plan backup and disaster recovery

## 📊 Monitoring and Metrics

### Key Metrics to Track
- **Cache hit rate**: Target >70%
- **Build time reduction**: Target 50-80%
- **Cache size growth**: Monitor storage usage
- **Network transfer**: Monitor bandwidth usage

### Monitoring Tools
- [ ] Turbo built-in analytics
- [ ] Custom dashboards (Grafana)
- [ ] CI/CD build time tracking
- [ ] Cost monitoring

## 🔧 Troubleshooting

### Common Issues
- **Low cache hit rate**: Check task configuration and inputs
- **Authentication errors**: Verify tokens and permissions
- **Network timeouts**: Check connectivity and firewall rules
- **Storage issues**: Monitor disk space and cleanup policies

### Debug Commands
```bash
# Check cache configuration
turbo run build --dry-run

# Force cache miss for testing
turbo run build --force

# Verbose cache logging
turbo run build --verbosity=2
```

## 💡 Best Practices

1. **Start with Vercel**: Use official solution first, migrate to self-hosted if needed
2. **Monitor costs**: Track cache storage and transfer costs
3. **Secure access**: Use proper authentication and network security
4. **Regular cleanup**: Implement cache eviction policies
5. **Team training**: Ensure team understands cache behavior

## 🎯 Success Criteria

- [ ] **Build times reduced by 50%+** for incremental changes
- [ ] **Cache hit rate >70%** in CI/CD
- [ ] **Zero cache-related build failures**
- [ ] **Team adoption >90%** (developers using cache locally)
- [ ] **Cost neutral or positive** (savings > infrastructure costs)

## 📚 Additional Resources

### **ducktors/turborepo-remote-cache**
- [GitHub Repository](https://github.com/ducktors/turborepo-remote-cache)
- [Full Documentation](https://ducktors.github.io/turborepo-remote-cache/)
- [Supported Storage Providers](https://ducktors.github.io/turborepo-remote-cache/supported-storage-providers)
- [Environment Variables](https://ducktors.github.io/turborepo-remote-cache/environment-variables)
- [Deployment Instructions](https://ducktors.github.io/turborepo-remote-cache/deployment-environments)
- [Docker Hub](https://hub.docker.com/r/ducktors/turborepo-remote-cache)

### **Official Turborepo Documentation**
- [Turborepo Remote Cache Documentation](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Vercel Remote Cache Setup](https://vercel.com/docs/concepts/monorepos/remote-caching)
- [Custom Remote Cache Server](https://turbo.build/repo/docs/core-concepts/remote-caching#self-hosting)

### **Related Projects**
- [GitHub Actions Integration](https://github.com/trappar/turborepo-remote-cache-gh-action)
- [AWS CDK Construct](https://github.com/NimmLor/cdk-turborepo-remote-cache)
- [Turbo Daemon](https://github.com/NullVoxPopuli/turbo-daemon)
