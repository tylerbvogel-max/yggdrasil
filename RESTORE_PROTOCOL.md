# Yggdrasil Restore Protocol

Step-by-step guide to restore Yggdrasil from scratch on a fresh Linux environment (tested on ChromeOS/Crostini Debian).

---

## Prerequisites

| Component | Version Used | Install |
|-----------|-------------|---------|
| Python | 3.11+ | `sudo apt install python3 python3-venv python3-pip` |
| Node.js | 20.x or 22.x | Via [nvm](https://github.com/nvm-sh/nvm) |
| PostgreSQL | 15.x | `sudo apt install postgresql postgresql-client` |
| Git | any | `sudo apt install git` |

---

## 1. Clone the Repository

```bash
mkdir -p ~/Projects && cd ~/Projects
git clone https://github.com/tylerbvogel-max/yggdrasil.git
cd yggdrasil
```

---

## 2. Set Up PostgreSQL

Start the service and create the database user and database:

```bash
sudo service postgresql start
sudo -u postgres psql <<SQL
CREATE USER yggdrasil WITH PASSWORD 'yggdrasil';
CREATE DATABASE yggdrasil OWNER yggdrasil;
GRANT ALL PRIVILEGES ON DATABASE yggdrasil TO yggdrasil;
SQL
```

Verify connectivity:

```bash
psql -U yggdrasil -h localhost -c "SELECT 1;" yggdrasil
```

> If prompted for a password, it's `yggdrasil`. You can add `localhost:5432:yggdrasil:yggdrasil:yggdrasil` to `~/.pgpass` and `chmod 600 ~/.pgpass` to skip prompts.

---

## 3. Restore the Database Backup

Backups are gzipped SQL dumps stored in the project root.

```bash
cd ~/Projects/yggdrasil

# Find the latest backup
ls -lt yggdrasil_backup_*.sql.gz | head -1

# Restore it (replace filename with latest)
gunzip -c yggdrasil_backup_2026-03-11.sql.gz | psql -U yggdrasil -h localhost yggdrasil
```

> If restoring into a database that already has data, drop and recreate first:
> ```bash
> sudo -u postgres psql -c "DROP DATABASE yggdrasil;"
> sudo -u postgres psql -c "CREATE DATABASE yggdrasil OWNER yggdrasil;"
> gunzip -c yggdrasil_backup_2026-03-11.sql.gz | psql -U yggdrasil -h localhost yggdrasil
> ```

Verify the restore:

```bash
psql -U yggdrasil -h localhost yggdrasil -c "SELECT COUNT(*) FROM neurons;"
# Expected: ~2100 neurons
psql -U yggdrasil -h localhost yggdrasil -c "SELECT COUNT(*) FROM neuron_edges;"
# Expected: ~390K+ edges
```

---

## 4. Set Up the Backend

```bash
cd ~/Projects/yggdrasil/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables

The backend reads config from environment or a `.env` file. The defaults work for local dev, but you need your Anthropic API key:

```bash
cat > ~/Projects/yggdrasil/backend/.env <<'EOF'
ANTHROPIC_API_KEY=sk-ant-your-key-here
DATABASE_URL=postgresql+asyncpg://yggdrasil:yggdrasil@localhost:5432/yggdrasil
EOF
```

### Start the Backend

```bash
cd ~/Projects/yggdrasil/backend
source venv/bin/activate
uvicorn app.main:app --port 8002 --reload
```

Verify:

```bash
curl -s http://localhost:8002/health | python3 -m json.tool
# Should show status: ok, neuron_count: ~2100
```

---

## 5. Set Up the Frontend

```bash
cd ~/Projects/yggdrasil/frontend
npm install
```

### For development:

```bash
npm run dev
# Runs on port 5173, proxies API calls to localhost:8002
```

### For production build (served by FastAPI):

```bash
npm run build
# Outputs to frontend/dist/, automatically served by the backend
```

---

## 6. Running as a Background Service (Optional)

To run the backend in the background without a terminal:

```bash
cd ~/Projects/yggdrasil/backend
source venv/bin/activate
nohup uvicorn app.main:app --port 8002 --reload > /dev/null 2>&1 &
```

To stop it:

```bash
fuser -k 8002/tcp
```

---

## 7. Creating New Backups

Run this periodically or before any risky changes:

```bash
pg_dump -U yggdrasil -h localhost yggdrasil | gzip > ~/Projects/yggdrasil/yggdrasil_backup_$(date +%Y-%m-%d).sql.gz
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start PostgreSQL | `sudo service postgresql start` |
| Start backend | `cd backend && source venv/bin/activate && uvicorn app.main:app --port 8002 --reload` |
| Start frontend (dev) | `cd frontend && npm run dev` |
| Build frontend | `cd frontend && npm run build` |
| Health check | `curl localhost:8002/health` |
| Backup DB | `pg_dump -U yggdrasil -h localhost yggdrasil \| gzip > yggdrasil_backup_$(date +%Y-%m-%d).sql.gz` |
| Restore DB | `gunzip -c backup.sql.gz \| psql -U yggdrasil -h localhost yggdrasil` |
| Kill backend | `fuser -k 8002/tcp` |
