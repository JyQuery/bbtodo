# bbtodo

`bbtodo` is a minimal kanban with:

- multiple projects
- flexible lanes
- only OIDC login
- personal API tokens
- React frontend, Fastify server, and SQLite

## Use The Repo-Local AI Skill

This repo includes a repo-local Codex skill at `./skills/bbtodo/SKILL.md`.

Tell your AI agents to use that skill explicitly each time. Do not assume they will discover or invoke it automatically on their own.

If you keep an `AGENTS.md` in the repo, a good default instruction is:

```md
Always use `$bbtodo` at `./skills/bbtodo/SKILL.md` for BBTodo work tracking: create a task before substantial work, move it to In Progress when active work starts, and move it to In review when the work is ready.
```

## Run the project

```bash
# Create .env file and modify as you wish
wget https://raw.githubusercontent.com/BBcanopy/bbtodo/refs/heads/main/.env.example -O .env 

# Download the all-in-one docker compose file
wget https://raw.githubusercontent.com/BBcanopy/bbtodo/refs/heads/main/docker-compose.all-in-one.yml -O docker-compose.yml

# Create data folder
mkdir data

docker compose up -d
```

The app is available at `http://localhost:8080` by default.
