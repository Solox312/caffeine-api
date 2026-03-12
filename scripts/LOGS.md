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

## Common log patterns

### Nginx error log

- **`upstream timed out (110: Connection timed out) while reading response header from upstream`**  
  Nginx gave up waiting for the API (127.0.0.1:3000). Common when the API is slow (e.g. Streameast events using browser fallback ~25–30s) or the API/container was down. Fix: increase `proxy_read_timeout` for long routes (e.g. `/streameast/`) or ensure the API responds within the current timeout.

- **`upstream prematurely closed connection while reading response header from upstream`**  
  The API closed the connection before sending a full response (e.g. process crash or uncaught exception). Check API/Docker logs for the same time.

- **`recv() failed (104: Connection reset by peer)`**  
  Upstream (API) reset the TCP connection. Can happen on restart or when the app crashes mid-request.

### API (Docker) – Streameast

- **`[Streameast] getEvents: trying https://...` then `all fetch failed, trying browser fallback`**  
  Direct HTTP fetch to mirror domains failed (blocked/403/429/timeout). API falls back to headless browser (e.g. streameast.ga); that can take 20–35s and may still succeed (e.g. `getEventsWithBrowser: got 37 events`).

- **`request completed` with `responseTime` 20000–35000 ms for `/streameast/events`**  
  Normal when the browser fallback is used; the client may see a slow response or Nginx timeout (502) if the proxy timeout is shorter than this.

- **`HTTP 429 Too Many Requests` then `streameast/stream failed`**  
  The Streameast mirror (e.g. streameast.ga) is rate-limiting the server. The API returns 502 to the client. Mitigations: use `WORKERS_URL` to proxy requests, or have the app open the event page in browser/WebView when the API returns 429/502.

- **`/streameast/stream` 502 after `getStreamLinks: fetching ...`**  
  Usually the same 429 (or other upstream error) from the mirror; see API log line just before for the exact error.

### Nginx access log

- **`GET /streameast/events HTTP/1.1` 502** – Upstream timed out or API error; see nginx error and API logs.
- **`GET /streameast/stream?url=...` 502** – Often upstream 429 or timeout; see API log for `HTTP 429` or timeout.

## Permissions

- Nginx log files are usually owned by root; use `sudo` to read them.
- Docker logs need no sudo if your user is in the `docker` group.
