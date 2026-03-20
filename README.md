# bbtodo

`bbtodo` is a minimal kanban with:

- multiple projects
- flexible lanes
- only OIDC login
- personal API tokens
- React frontend, Fastify server, and SQLite

## Run the project

```bash
# Create .env file and modify as you wish
wget https://raw.githubusercontent.com/JyQuery/bbtodo/refs/heads/main/.env.example -O .env 

# Download the all-in-one docker compose file
wget https://raw.githubusercontent.com/JyQuery/bbtodo/refs/heads/main/docker-compose.all-in-one.yml -O docker-compose.all-in-one.yml

# Create data folder
mkdir data

docker compose -f docker-compose.all-in-one.yml up -d
```

`docker-compose.all-in-one.yml` runs the published `ghcr.io/jyquery/bbtodo-all-in-one` image.
The Fastify server serves both the API and the compiled frontend on the same port, so the app is available at `http://localhost:8080` by default.
