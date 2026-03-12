# Use CloudWatch for logs (AWS)

Send Nginx and Caffeine API logs to CloudWatch so you can view and search them in the AWS Console without SSH.

## 1. IAM permissions (EC2 instance role)

Attach a policy to the **EC2 instance role** so the instance (and CloudWatch agent + Docker) can write logs.

**Console:** EC2 → your instance → Security → IAM role. Create or edit the role and add this policy (create inline or use a custom policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/ec2/caffeine-api/*"
    }
  ]
}
```

If your instance has no role, attach one (e.g. create a role with the policy above and assign it to the instance).

## 2. Nginx logs (CloudWatch agent)

The agent reads Nginx log files and sends them to CloudWatch.

### Install the agent (one-time, on the EC2 box)

```bash
# Amazon Linux 2 / RHEL
sudo yum install -y amazon-cloudwatch-agent

# Ubuntu
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
```

### Deploy the config

From your **caffeine-api** repo on the server (or copy the JSON from `scripts/amazon-cloudwatch-agent-config.json`):

```bash
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
sudo cp /path/to/caffeine-api/scripts/amazon-cloudwatch-agent-config.json \
       /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

### Start the agent

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

After this, Nginx logs will go to:

- **Log group:** `/aws/ec2/caffeine-api/nginx-access`
- **Log group:** `/aws/ec2/caffeine-api/nginx-error`

## 3. API logs (Docker → CloudWatch)

Use the **awslogs** Docker log driver so container stdout/stderr go straight to CloudWatch (no agent needed for the API).

### Restart the API with CloudWatch

From the caffeine-api repo:

```bash
export AWS_REGION=us-east-1   # or your region, e.g. us-west-2
./scripts/restart-aws.sh --cloudwatch
```

Optional: set log group / region via env so you don’t need to export each time:

```bash
# In .env or your shell profile
export AWS_REGION=us-east-1
export CLOUDWATCH_LOG_GROUP=/aws/ec2/caffeine-api/api
```

Then:

```bash
./scripts/restart-aws.sh --cloudwatch
```

API logs will go to:

- **Log group:** `/aws/ec2/caffeine-api/api`  
  (or the value of `CLOUDWATCH_LOG_GROUP`)

## 4. Where to view logs

1. Open **AWS Console** → **CloudWatch** → **Log groups**.
2. Open:
   - `/aws/ec2/caffeine-api/nginx-access`
   - `/aws/ec2/caffeine-api/nginx-error`
   - `/aws/ec2/caffeine-api/api`
3. Open a **log stream** to see events. Use **Search log group** to filter.

No SSH needed; logs are in one place and retained (e.g. 7 days in the provided config).

## 5. Retention and cost

- In `amazon-cloudwatch-agent-config.json`, `retention_in_days: 7` is set for Nginx logs. Adjust or add the same for the API log group in the Console if you want.
- CloudWatch Logs is billed by ingestion and storage; a single EC2 with light traffic is usually a few dollars per month.

## 6. One-time setup summary

| Step | What to do |
|------|------------|
| IAM | Add the logs policy to the EC2 instance role |
| Agent | Install CloudWatch agent on the instance |
| Config | Copy `scripts/amazon-cloudwatch-agent-config.json` to `/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json` |
| Agent start | Run the `amazon-cloudwatch-agent-ctl` command above |
| API | Restart with `./scripts/restart-aws.sh --cloudwatch` (and set `AWS_REGION` / `CLOUDWATCH_LOG_GROUP` if needed) |

After that, use CloudWatch Logs in the console for Nginx and API logs.
