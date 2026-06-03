# Secrets Rotation Guide

The original `PropCRM_2025!` database password and JWT secrets were exposed in plain text.
Follow these steps to complete the rotation before restarting the application.

---

## 1. Rotate the PostgreSQL password

Connect to your running PostgreSQL instance and run:

```sql
ALTER USER propcrm PASSWORD 'your_new_strong_password';
```

Generate a strong password first:
```
openssl rand -base64 32
```

Then update **both** of these files with the new password:

| File | Key |
|------|-----|
| `.env` | `DB_PASSWORD=` |
| `backend/.env` | `DATABASE_URL="postgresql://propcrm:NEW_PASSWORD@..."` |

---

## 2. JWT secrets

New JWT secrets have already been generated and written to `.env` and `backend/.env`.
**All existing user sessions are now invalid** — users will need to log in again. This is expected and correct behavior after a secret rotation.

To generate additional secrets at any time:
```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 3. Verify .gitignore is working

Before initializing a git repository, confirm that neither `.env` file will be tracked:

```
git check-ignore -v .env backend/.env
```

Both should be listed. If not, do not commit until `.gitignore` is confirmed.

---

## 4. Production / CI deployments

Never store secrets in files that are committed to source control. Instead:

| Platform | How to inject secrets |
|----------|-----------------------|
| GitHub Actions | Settings → Secrets and variables → Actions |
| Docker Compose (prod) | `env_file` referencing a file outside the repo, or Docker secrets |
| Railway / Render / Fly | Environment variable settings in the dashboard |
| Kubernetes | `kubectl create secret generic` |

Reference env vars in code via `process.env.VARIABLE_NAME` — never hardcode values.

---

## 5. Revoke any other exposed credentials

If `PropCRM_2025!` or the old JWT secrets were reused anywhere else (other services,
staging environments, etc.), rotate those immediately as well.
