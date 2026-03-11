# Deploying Caffeine API on AWS

This guide covers deploying the API on AWS (EC2, ECS, EKS) with full Chromium support for Streameast stream extraction.

## Why AWS?

Vercel serverless lacks system libraries (`libnss3.so`, etc.) required by Chromium. Running on a VPS (EC2, ECS, etc.) provides a full Linux environment where Chromium and its dependencies work correctly.

## Quick Start

### Option 1: Docker on EC2

1. **Launch EC2 instance** (Ubuntu 22.04, t3.small or larger)
2. **Install Docker**:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose
   sudo usermod -aG docker ubuntu
   # Log out and back in
   ```
3. **Clone and run**:
   ```bash
   git clone <your-repo> && cd caffeine-api
   cp .env.example .env && nano .env  # Set TMDB_KEY, CAFFEINE_API_URL, etc.
   docker build -f Dockerfile.aws -t caffeine-api .
   docker run -d -p 3000:3000 --env-file .env --restart unless-stopped caffeine-api
   ```

### Option 2: ECS Fargate

1. Push the image to ECR:
   ```bash
   aws ecr create-repository --repository-name caffeine-api
   aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
   docker build -f Dockerfile.aws -t <account>.dkr.ecr.<region>.amazonaws.com/caffeine-api:latest .
   docker push <account>.dkr.ecr.<region>.amazonaws.com/caffeine-api:latest
   ```
2. Create an ECS task definition using the image and env vars (Secrets Manager or env vars).
3. Create an ECS service with a load balancer.

### Option 3: Run without Docker (Node on EC2)

1. **Launch EC2** (Ubuntu 22.04)
2. **Install Node.js 20**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
3. **Install Chromium deps** (required for Streameast browser fallback):
   ```bash
   sudo apt install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libgbm1
   ```
4. **Deploy app**:
   ```bash
   git clone <repo> && cd caffeine-api
   npm install && npm run build
   cp .env.example .env && nano .env
   npm run start:prod
   ```
5. **Run with PM2** (recommended):
   ```bash
   sudo npm install -g pm2
   pm2 start dist/index.js --name caffeine-api
   pm2 save && pm2 startup
   ```

## Environment Variables

Set these in `.env` or your deployment config:

| Variable | Required | Description |
|----------|----------|-------------|
| `TMDB_KEY` | Yes | TMDB API key |
| `CAFFEINE_API_URL` | Yes | Public URL of this API (used by Flutter app) |
| `WORKERS_URL` | No | Proxy URL for provider requests |
| `REDIS_HOST` | No | Redis host (cache) |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |

## Reverse Proxy (Nginx)

For HTTPS and a domain:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Use Certbot for SSL: `sudo certbot --nginx -d api.yourdomain.com`

## Dockerfile.aws

The `Dockerfile.aws` image includes:
- Node 20 on Debian Bookworm
- Chromium shared libraries (libnss3, libnspr4, etc.) for `@sparticuz/chromium`
- Healthcheck on `/status`
- Production build (compiled TypeScript)
