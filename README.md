# reSource — Pass Value Forward

A responsive community reuse platform for giving useful things a second life through **Donate, Reuse, Repair, and Recycle**. This repository is the complete working-code bundle for local development and an AWS deployment path. AWS resources still need to be created in your own AWS account; the code cannot create them without account access and explicit credentials.

## Product functions

- Responsive landing page for desktop, tablet, and mobile.
- Browse item listings across Books & Paper, Clothing, Electronics, Furniture, and Household.
- Search titles, descriptions, categories, actions, and locations.
- Filter by category/action, sort newest/oldest, and show saved items.
- Open listing details and save/unsave favourites in the current browser.
- Register with email/password, verify email code, sign in, and sign out with Amazon Cognito.
- Authenticated users can publish listings and request available items.
- API validates listings; the server verifies Cognito access tokens; users cannot request their own listings or delete another user's listing through the API.
- PostgreSQL persists listings and requests. Database initialization performs additive migrations and does not drop the existing tables or Docker volume.
- Health endpoint, API input validation, security headers, CORS, CI tests/build, Docker support, and an AWS deployment workflow.

**Current MVP limits:** favourites are browser-local. Claim requests are saved in PostgreSQL; an owner-facing claim-management screen, email/SMS notifications, image uploads, admin moderation, and production analytics are not implemented. Do not advertise those as available features yet.

## Stack

- Frontend: React 18, TypeScript, Vite, CSS, Lucide icons, AWS Amplify Auth.
- API: Node.js 22, Express, `aws-jwt-verify`, Helmet, CORS.
- Database: PostgreSQL 16.
- Authentication: Amazon Cognito User Pool.
- CI: GitHub Actions.
- AWS deployment path: private S3 bucket + CloudFront for frontend; ECR + ECS Fargate for API; RDS PostgreSQL; Secrets Manager; CloudWatch Logs; GitHub Actions using AWS OIDC.

## 1. Requirements

- Node.js 22+ and npm.
- Docker Desktop running.
- Git.
- For live deployment: AWS account, AWS CLI, and Terraform is optional (the initial resources in this bundle are set up from the AWS console/CLI).

## 2. Run locally on Windows

Open CMD in `D:\projects\reSource` (or wherever you extracted the project):

```bat
copy services\resource-service\.env.example services\resource-service\.env
copy frontend\.env.example frontend\.env
npm install
npm --prefix services/resource-service install
npm --prefix frontend install
docker compose up -d postgres
npm run dev
```

Open `http://localhost:5173`; API health is `http://localhost:4001/health`.

**Keep your existing `.env` files and database.** If `resource-postgres` is already running on port `5433` with volume `resource_pgdata`, do not remove the container or volume and do not run `docker compose down -v`. Keep the current backend `DATABASE_URL`, `PORT`, and `FRONTEND_URL` values. The database migration is additive.

If you have an existing backend `.env`, do not overwrite it with the example. Ensure it has these values while preserving your existing database URL:

```dotenv
PORT=4001
DATABASE_URL=postgresql://resource_user:resource_dev_password@localhost:5433/resource_db
FRONTEND_URL=http://localhost:5173
DATABASE_SSL=false
COGNITO_USER_POOL_ID=YOUR_USER_POOL_ID
COGNITO_CLIENT_ID=YOUR_APP_CLIENT_ID
```

If you do not have Cognito configured yet, browsing works, but account-only features will remain unavailable until Cognito is configured.

### Cognito setup

1. In AWS Console, open **Amazon Cognito → User pools → Create user pool**.
2. Choose email as sign-in, enable email verification, and create a browser app client **without a client secret**.
3. Copy the User Pool ID and App Client ID.
4. Put them in `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:4001/api
VITE_COGNITO_USER_POOL_ID=YOUR_USER_POOL_ID
VITE_COGNITO_CLIENT_ID=YOUR_APP_CLIENT_ID
```

5. Put the same pool ID/client ID in `services/resource-service/.env` as `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`.
6. Restart both processes after editing `.env` files. Vite variables are embedded at build time.

Do not use a Cognito app client with a client secret in a browser application. Never commit `.env` files or database credentials.

## 3. Checks

From the project root:

```bat
npm run build
npm --prefix services/resource-service test
```

PowerShell health checks:

```powershell
Invoke-RestMethod http://localhost:4001/health
Invoke-RestMethod http://localhost:4001/api/resources
```

## 4. API endpoints

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| GET | `/health` | API and database health | Public |
| GET | `/api/resources` | Search/filter/paginate listings | Public |
| GET | `/api/resources/:id` | Read one listing | Public |
| POST | `/api/resources` | Publish a listing | Cognito access token |
| DELETE | `/api/resources/:id` | Delete own listing | Cognito access token + ownership check |
| POST | `/api/resources/:id/claims` | Request an available item | Cognito access token |

`GET /api/resources` supports `search`, `category`, `action`, `location`, `status`, `limit`, and `offset` query parameters.

## 5. GitHub CI

`.github/workflows/ci.yml` runs the frontend TypeScript/Vite build, backend validation tests, and server syntax check on pushes and pull requests. Push this repository to GitHub and inspect the **Actions** tab.

## 6. AWS live deployment

### Important service choice

The workflow in this version uses **ECS Fargate**, not App Runner. AWS stopped accepting new App Runner customers in 2026, so ECS is the better path for a new deployment. See AWS's [App Runner availability notice](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html) and [ECS Express Mode deployment guidance](https://aws.amazon.com/blogs/containers/automated-deployments-with-github-actions-for-amazon-ecs-express-mode/).

### Target architecture

- **Frontend:** private S3 bucket served by CloudFront over HTTPS.
- **API:** Docker image in ECR, deployed to an ECS Fargate service behind an Application Load Balancer (ALB).
- **Database:** private RDS PostgreSQL instance, reachable only from the API service security group.
- **Authentication:** Cognito User Pool.
- **Secrets/logs:** database URL in Secrets Manager; API logs in CloudWatch Logs.
- **CI/CD:** GitHub Actions assumes an AWS IAM role using OIDC; no long-lived AWS access keys in GitHub.

### Create AWS resources once

The deployment workflow updates resources; it does **not** create your AWS account, VPC, database, Cognito pool, ECS service, bucket, or CloudFront distribution. Create/configure the following once in your AWS account:

1. **Cognito:** create a User Pool and browser app client (no client secret). Record the pool ID and client ID.
2. **S3 + CloudFront:** create a private frontend bucket and CloudFront distribution with Origin Access Control (OAC), default root object `index.html`, and HTTPS viewer redirect. Configure a second CloudFront origin pointing to your ALB and ordered behaviors `/api/*` and `/health` to that ALB. Disable caching for those API/health behaviors and forward the required headers, query strings, and HTTP methods. The API should be reached through the CloudFront HTTPS domain, e.g. `https://YOUR_CLOUDFRONT_DOMAIN/api`.
3. **RDS PostgreSQL:** create PostgreSQL 16 in private subnets. Allow inbound port `5432` only from the ECS API task security group. Create a Secrets Manager secret containing the complete connection string, e.g. `postgresql://DB_USER:STRONG_PASSWORD@RDS_ENDPOINT:5432/resource_db`.
4. **ECR:** create a repository named `resource-service`.
5. **ECS Fargate:** create a cluster and a Fargate service named `resource-service`, behind an ALB. Container name must be exactly `resource-service`, container port `4001`, health-check path `/health`. Configure the task definition environment variables `PORT=4001`, `FRONTEND_URL=https://YOUR_CLOUDFRONT_DOMAIN`, `DATABASE_SSL=true`, `COGNITO_USER_POOL_ID`, and `COGNITO_CLIENT_ID`. Add `DATABASE_URL` as a **Secrets Manager secret reference**, not a plain-text value. Attach a task execution role with ECR pull, CloudWatch Logs, and permission to read only that database secret. Use private RDS networking. The example task definition is in `infra/aws/ecs-task-definition.example.json`.
6. **GitHub OIDC IAM role:** configure GitHub as an OIDC identity provider (`token.actions.githubusercontent.com`) and restrict the role trust policy to your exact repository and the `main` branch. Give it only the permissions needed to push to the one ECR repository, register/describe task definitions, update the one ECS service, sync the one S3 bucket, and invalidate the one CloudFront distribution. Avoid storing AWS access keys.
7. **Frontend routing:** verify CloudFront sends `/api/*` and `/health` to the ALB and all other paths to S3. Set the frontend API URL to `https://YOUR_CLOUDFRONT_DOMAIN/api`.

### GitHub Actions variables and secrets

In **GitHub repository → Settings → Secrets and variables → Actions**, add these **Variables**:

- `AWS_REGION` — e.g. `ap-south-1`.
- `AWS_ECR_REPOSITORY` — `resource-service`.
- `AWS_ECS_CLUSTER` — your ECS cluster name.
- `AWS_ECS_SERVICE` — `resource-service` (or the exact ECS service name you created).
- `AWS_FRONTEND_BUCKET` — S3 bucket name.
- `AWS_CLOUDFRONT_DISTRIBUTION_ID` — CloudFront distribution ID.
- `VITE_API_URL` — `https://YOUR_CLOUDFRONT_DOMAIN/api`.
- `VITE_COGNITO_USER_POOL_ID` — Cognito User Pool ID.
- `VITE_COGNITO_CLIENT_ID` — Cognito app client ID.

Add this **Secret**:

- `AWS_ROLE_ARN` — ARN of the GitHub OIDC IAM role.

The ECS task definition must already contain the `DATABASE_URL` secret reference and the backend `COGNITO_*` environment variables. The deployment workflow fetches the active task definition, replaces its image with the new commit image, and deploys it.

### Deploy

1. Push the project to the `main` branch.
2. Open **GitHub → Actions → Deploy reSource to AWS → Run workflow**.
3. Wait for the workflow to complete and inspect CloudFront, ECS service events, and CloudWatch logs if a step fails.
4. Open the CloudFront HTTPS domain and test sign-up/email verification, sign-in, browse, create listing, request item, and sign-out on both laptop and phone widths.

AWS resources incur charges. Choose small development sizes, configure budget alerts, and delete resources when finished. Do not expose RDS to the public internet. Do not commit Terraform state, `.env`, database passwords, or AWS credentials.

## Project structure

```text
reSource/
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-aws.yml
├── frontend/
│   ├── src/App.tsx
│   ├── src/auth.ts
│   ├── src/main.tsx
│   ├── src/styles.css
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── services/resource-service/
│   ├── src/server.js
│   ├── src/validation.js
│   ├── src/validation.test.js
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── infra/aws/ecs-task-definition.example.json
├── docker-compose.yml
└── package.json
```
