# Logs on AWS (EC2)

Quick reference for Nginx and Caffeine API logs.

## Script: `logs-aws.sh`

From the **caffeine-api** repo (or any directory; paths are fixed):

```bash
chmod +x scripts/logs-aws.sh

# Last 100 lines (default)
./scripts/logs-aws.sh api              # API (Docker)
./scripts/logs-aws.sh nginx-access     # Nginx requests
./scripts/logs-aws.sh nginx-error       # Nginx errors
./scripts/logs-aws.sh all              # Last 50 of each

# Live tail (follow)
./scripts/logs-aws.sh api -f
./scripts/logs-aws.sh nginx-error -f
./scripts/logs-aws.sh nginx-access -f
```

## Log locations (without script)

| Log | Path / Command |
|-----|----------------|
| **Nginx access** | `sudo tail -f /var/log/nginx/access.log` |
| **Nginx error** | `sudo tail -f /var/log/nginx/error.log` |
| **Caffeine API** | `docker logs -f caffeine-api` |

## AWS CloudWatch (optional)

To have logs in one place and keep them after reboot:

1. **Install CloudWatch agent** on the EC2 instance (AWS docs: “Install CloudWatch agent on EC2”).
2. **Configure** the agent to ship:
   - `/var/log/nginx/access.log`
   - `/var/log/nginx/error.log`
   - Docker container logs (e.g. via the agent’s “Docker” log source or by logging to a file and shipping that file).
3. **View** in AWS Console → CloudWatch → Log groups → Log streams.

Then you can search and filter in the console without SSH.

## Permissions

- Nginx log files are usually owned by root; use `sudo` to read them.
- Docker logs need no sudo if your user is in the `docker` group.
