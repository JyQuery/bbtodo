import { startTransition, useState, type CSSProperties } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";

import { api, ApiError, isApiError, type Task, type TaskStatus, type User } from "./api";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false
    }
  }
});

const columns: Array<{ key: TaskStatus; label: string; note: string }> = [
  { key: "todo", label: "Todo", note: "Queued and ready to pick up" },
  { key: "in_progress", label: "In Progress", note: "Active work with clear focus" },
  { key: "done", label: "Done", note: "Finished and ready to clear out" }
];

const loginPreview: Record<TaskStatus, string[]> = {
  todo: ["Audit callback route", "Rename API settings", "Trim Docker health probes"],
  in_progress: ["Refine board spacing", "Polish token reveal state"],
  done: ["Wire OIDC login", "Split web and server packages"]
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

function itemStyle(index: number): CSSProperties {
  return { "--item-index": index } as CSSProperties;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...options
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function MetricRibbon({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="metric-ribbon">
      {items.map((item, index) => (
        <div className="metric-pill" key={item.label} style={itemStyle(index)}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  return <p className="error-banner">{getErrorMessage(error)}</p>;
}

function EmptyState({
  eyebrow,
  title,
  copy
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <section className="empty-state">
      <div className="empty-state__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="lead-copy">{copy}</p>
      </div>
      <div aria-hidden="true" className="empty-state__art">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function ProjectGridSkeleton() {
  return (
    <section className="project-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <article className="project-card skeleton-card" key={index} style={itemStyle(index)}>
          <div className="skeleton-line skeleton-line--small" />
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--body" />
          <div className="skeleton-line skeleton-line--body short" />
          <div className="skeleton-row">
            <div className="skeleton-pill" />
            <div className="skeleton-pill" />
          </div>
        </article>
      ))}
    </section>
  );
}

function BoardSkeleton() {
  return (
    <section className="board-grid" aria-hidden="true">
      {columns.map((column, index) => (
        <article className="board-column skeleton-column" key={column.key} style={itemStyle(index)}>
          <div className="board-column__header">
            <div>
              <div className="skeleton-line skeleton-line--small" />
              <div className="skeleton-line skeleton-line--medium" />
            </div>
            <div className="skeleton-pill" />
          </div>
          <div className="board-column__content">
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <div className="task-card skeleton-card skeleton-card--compact" key={cardIndex}>
                <div className="skeleton-line skeleton-line--small" />
                <div className="skeleton-line skeleton-line--body" />
                <div className="skeleton-line skeleton-line--body short" />
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function TokenListSkeleton() {
  return (
    <section aria-hidden="true" className="token-list">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="token-row token-row--skeleton" key={index}>
          <div className="token-row__copy">
            <div className="skeleton-line skeleton-line--medium" />
            <div className="skeleton-line skeleton-line--body short" />
          </div>
          <div className="skeleton-pill" />
        </div>
      ))}
    </section>
  );
}

function LoadingState() {
  return (
    <main className="loading-shell">
      <div className="loading-shell__inner">
        <section className="page-intro">
          <article className="hero-panel">
            <div className="skeleton-line skeleton-line--small" />
            <div className="skeleton-line skeleton-line--hero" />
            <div className="skeleton-line skeleton-line--body" />
            <div className="skeleton-line skeleton-line--body short" />
            <MetricRibbon
              items={[
                { label: "Boards", value: "Loading" },
                { label: "Access", value: "Checking" },
                { label: "Sync", value: "Preparing" }
              ]}
            />
          </article>
          <aside className="surface-panel surface-panel--form">
            <div className="skeleton-line skeleton-line--small" />
            <div className="skeleton-line skeleton-line--medium" />
            <div className="skeleton-line skeleton-line--body" />
            <div className="skeleton-button" />
          </aside>
        </section>
        <BoardSkeleton />
      </div>
    </main>
  );
}

function LoginScreen() {
  return (
    <main className="landing-shell">
      <section className="landing-panel">
        <article className="hero-panel hero-panel--landing">
          <p className="eyebrow">bbtodo</p>
          <h1>Simple boards for work that should stay clear.</h1>
          <p className="lead-copy">
            Sign in once, keep one board per project, and move tasks across three steady lanes without extra ceremony.
          </p>
          <MetricRibbon
            items={[
              { label: "Projects", value: "One board each" },
              { label: "Access", value: "OIDC sign-in" },
              { label: "API", value: "Tokens for scripts" }
            ]}
          />
          <div className="cta-row">
            <button className="primary-button" onClick={() => (window.location.href = "/auth/login")} type="button">
              Sign in with OIDC
            </button>
            <a className="ghost-button" href="/docs">
              Read API docs
            </a>
          </div>
        </article>

        <aside className="preview-panel">
          <div className="preview-panel__header">
            <div>
              <p className="eyebrow">Live shape</p>
              <h2>A calm three-lane board</h2>
            </div>
            <span className="status-ping" />
          </div>
          <div className="preview-board">
            {columns.map((column, columnIndex) => (
              <section className="preview-column" key={column.key} style={itemStyle(columnIndex)}>
                <header className="preview-column__header">
                  <h3>{column.label}</h3>
                  <span>{loginPreview[column.key].length}</span>
                </header>
                <div className="preview-column__stack">
                  {loginPreview[column.key].map((task, taskIndex) => (
                    <article className="preview-card" key={task} style={itemStyle(taskIndex)}>
                      <span className="preview-card__line" />
                      <p>{task}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function AppShell({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.clear();
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  return (
    <div className="app-frame">
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar__nav">
            <Link className="brand-mark" to="/">
              <span className="brand-mark__pill">bb</span>
              <span className="brand-mark__text">bbtodo</span>
            </Link>
            <nav className="subnav">
              <NavLink className={({ isActive }) => `subnav__link${isActive ? " is-active" : ""}`} end to="/">
                Projects
              </NavLink>
              <NavLink className={({ isActive }) => `subnav__link${isActive ? " is-active" : ""}`} to="/settings/api-tokens">
                API tokens
              </NavLink>
            </nav>
          </div>

          <div className="topbar__meta">
            <div className="topbar__identity">
              <p className="topbar__label">Signed in with OIDC</p>
              <p className="topbar__value">{user.name ?? "bbtodo workspace"}</p>
              <p className="topbar__subvalue">{user.email ?? "Authenticated session"}</p>
            </div>
            <button className="ghost-button" onClick={() => logoutMutation.mutate()} type="button">
              {logoutMutation.isPending ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>

        <div className="shell-content">
          <Routes>
            <Route element={<ProjectsPage />} path="/" />
            <Route element={<BoardPage />} path="/projects/:projectId" />
            <Route element={<ApiTokensPage />} path="/settings/api-tokens" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects()
  });

  const createProjectMutation = useMutation({
    mutationFn: (projectName: string) => api.createProject(projectName),
    onSuccess: async (project) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      startTransition(() => {
        navigate(`/projects/${project.id}`);
      });
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });

  const projectCount = projectsQuery.data?.length ?? 0;

  return (
    <main className="page-shell">
      <section className="page-intro">
        <article className="hero-panel">
          <p className="eyebrow">Projects</p>
          <h1>One board per project, clear enough to scan in seconds.</h1>
          <p className="lead-copy">
            Create a board when work starts, keep the same three lanes everywhere, and let the web UI and API stay in step.
          </p>
          <MetricRibbon
            items={[
              { label: "Boards", value: projectCount > 0 ? `${projectCount} active` : "Ready to start" },
              { label: "Lanes", value: "Todo, In Progress, Done" },
              { label: "Access", value: "Browser and API" }
            ]}
          />
        </article>

        <aside className="surface-panel surface-panel--form">
          <p className="panel-kicker">Create board</p>
          <h2>Start a new project.</h2>
          <p className="panel-copy">Each project gets one kanban board with the same three columns.</p>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              createProjectMutation.mutate(name.trim());
            }}
          >
            <label className="field">
              <span className="field__label">Project name</span>
              <input
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="Billing cleanup"
                required
                value={name}
              />
              <span className="field__hint">Use one clear name so the board is easy to find later.</span>
            </label>
            <button className="primary-button" disabled={createProjectMutation.isPending || name.trim().length === 0} type="submit">
              {createProjectMutation.isPending ? "Creating board..." : "Create board"}
            </button>
          </form>
        </aside>
      </section>

      {projectsQuery.error ? <ErrorBanner error={projectsQuery.error} /> : null}
      {createProjectMutation.error ? <ErrorBanner error={createProjectMutation.error} /> : null}
      {deleteProjectMutation.error ? <ErrorBanner error={deleteProjectMutation.error} /> : null}

      {projectsQuery.isPending ? <ProjectGridSkeleton /> : null}

      {!projectsQuery.isPending && projectsQuery.data && projectsQuery.data.length === 0 ? (
        <EmptyState
          copy="Create the first project to open a board with Todo, In Progress, and Done ready to go."
          eyebrow="Empty workspace"
          title="No boards yet."
        />
      ) : null}

      {!projectsQuery.isPending && projectsQuery.data && projectsQuery.data.length > 0 ? (
        <section className="project-grid">
          {projectsQuery.data.map((project, index) => (
            <article
              className={`project-card${index === 0 ? " project-card--featured" : ""}`}
              key={project.id}
              style={itemStyle(index)}
            >
              <div className="project-card__meta">
                <span className="label-chip">Board {String(index + 1).padStart(2, "0")}</span>
                <p className="project-card__timestamp">Updated {formatDate(project.updatedAt)}</p>
              </div>
              <div className="project-card__body">
                <h2>{project.name}</h2>
                <p className="project-card__summary">Fixed lanes keep the board familiar, even when the project itself changes fast.</p>
              </div>
              <div className="project-track" aria-label="Board columns">
                <span>Todo</span>
                <span>In Progress</span>
                <span>Done</span>
              </div>
              <div className="project-card__footer">
                <Link className="ghost-button" to={`/projects/${project.id}`}>
                  Open board
                </Link>
                <button className="text-button danger-button" onClick={() => deleteProjectMutation.mutate(project.id)} type="button">
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function TaskCard({
  onDelete,
  onMove,
  task,
  taskIndex
}: {
  onDelete: (taskId: string) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  task: Task;
  taskIndex: number;
}) {
  const currentIndex = columns.findIndex((column) => column.key === task.status);
  const previousColumn = currentIndex > 0 ? columns[currentIndex - 1] : null;
  const nextColumn = currentIndex < columns.length - 1 ? columns[currentIndex + 1] : null;

  return (
    <article className="task-card" style={itemStyle(taskIndex)}>
      <div className="task-card__meta">
        <span className="label-chip label-chip--soft">Updated {formatDate(task.updatedAt)}</span>
      </div>
      <p className="task-card__title">{task.title}</p>
      <div className="task-card__actions">
        <div className="task-card__moves">
          {previousColumn ? (
            <button className="micro-button" onClick={() => onMove(task, previousColumn.key)} type="button">
              Move to {previousColumn.label}
            </button>
          ) : null}
          {nextColumn ? (
            <button className="micro-button" onClick={() => onMove(task, nextColumn.key)} type="button">
              Move to {nextColumn.label}
            </button>
          ) : null}
        </div>
        <button className="text-button danger-button" onClick={() => onDelete(task.id)} type="button">
          Delete
        </button>
      </div>
    </article>
  );
}

function BoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects()
  });
  const tasksQuery = useQuery({
    enabled: Boolean(projectId),
    queryKey: ["tasks", projectId],
    queryFn: () => api.listTasks(projectId ?? "")
  });

  const createTaskMutation = useMutation({
    mutationFn: (taskTitle: string) => api.createTask(projectId ?? "", taskTitle),
    onSuccess: async () => {
      setTitle("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] })
      ]);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ status, task }: { status: TaskStatus; task: Task }) =>
      api.updateTask(projectId ?? "", task.id, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] })
      ]);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.deleteTask(projectId ?? "", taskId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] })
      ]);
    }
  });

  const project = projectsQuery.data?.find((candidate) => candidate.id === projectId);
  const tasks = tasksQuery.data ?? [];
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const groupedTasks = columns.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.key)
  }));

  if (!projectId) {
    return <Navigate replace to="/" />;
  }

  return (
    <main className="page-shell">
      <section className="page-intro">
        <article className="hero-panel">
          <button className="back-link" onClick={() => navigate("/")} type="button">
            Back to projects
          </button>
          <p className="eyebrow">Board</p>
          <h1>{project?.name ?? "Loading board"}</h1>
          <p className="lead-copy">
            Add a task, move it forward one lane at a time, and clear it out when the work is finished.
          </p>
          <MetricRibbon
            items={[
              { label: "Tasks", value: `${tasks.length} total` },
              { label: "Finished", value: `${doneCount} done` },
              { label: "Updated", value: project ? formatDate(project.updatedAt) : "Syncing" }
            ]}
          />
        </article>

        <aside className="surface-panel surface-panel--form">
          <p className="panel-kicker">Add task</p>
          <h2>Drop the next step on the board.</h2>
          <p className="panel-copy">New tasks land in Todo so the flow stays predictable.</p>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              createTaskMutation.mutate(title.trim());
            }}
          >
            <label className="field">
              <span className="field__label">Task title</span>
              <input
                maxLength={240}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Draft release note summary"
                required
                value={title}
              />
              <span className="field__hint">Keep titles short enough to scan from the board view.</span>
            </label>
            <button className="primary-button" disabled={createTaskMutation.isPending || title.trim().length === 0} type="submit">
              {createTaskMutation.isPending ? "Adding task..." : "Add task"}
            </button>
          </form>
        </aside>
      </section>

      {projectsQuery.error ? <ErrorBanner error={projectsQuery.error} /> : null}
      {tasksQuery.error ? <ErrorBanner error={tasksQuery.error} /> : null}
      {createTaskMutation.error ? <ErrorBanner error={createTaskMutation.error} /> : null}
      {updateTaskMutation.error ? <ErrorBanner error={updateTaskMutation.error} /> : null}
      {deleteTaskMutation.error ? <ErrorBanner error={deleteTaskMutation.error} /> : null}

      {projectsQuery.isPending || tasksQuery.isPending ? <BoardSkeleton /> : null}

      {!projectsQuery.isPending && projectsQuery.data && !project ? (
        <EmptyState
          copy="The project may have been removed. Head back to the project list and open another board."
          eyebrow="Missing board"
          title="That board is no longer available."
        />
      ) : null}

      {!projectsQuery.isPending && !tasksQuery.isPending && project ? (
        <section className="board-grid">
          {groupedTasks.map((column, columnIndex) => (
            <div className="board-column" key={column.key} style={itemStyle(columnIndex)}>
              <div className="board-column__header">
                <div>
                  <p className="board-column__note">{column.note}</p>
                  <h2>{column.label}</h2>
                </div>
                <span>{column.tasks.length}</span>
              </div>
              <div className="board-column__content">
                {column.tasks.map((task, taskIndex) => (
                  <TaskCard
                    key={task.id}
                    onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
                    onMove={(currentTask, status) => updateTaskMutation.mutate({ status, task: currentTask })}
                    task={task}
                    taskIndex={taskIndex}
                  />
                ))}
                {column.tasks.length === 0 ? (
                  <div className="column-empty">
                    <span className="column-empty__rule" />
                    <p>No tasks in this lane yet.</p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function ApiTokensPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const tokensQuery = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () => api.listApiTokens()
  });

  const createTokenMutation = useMutation({
    mutationFn: (tokenName: string) => api.createApiToken(tokenName),
    onSuccess: async (response) => {
      setName("");
      setRevealedToken(response.token);
      await queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    }
  });

  const deleteTokenMutation = useMutation({
    mutationFn: (tokenId: string) => api.deleteApiToken(tokenId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    }
  });

  const tokenCount = tokensQuery.data?.length ?? 0;

  return (
    <main className="page-shell">
      <section className="page-intro">
        <article className="hero-panel">
          <p className="eyebrow">Automation</p>
          <h1>Personal tokens for scripts that need a direct line in.</h1>
          <p className="lead-copy">
            Tokens use the same project and task endpoints as the app, so small tools can stay close to the board without extra setup.
          </p>
          <MetricRibbon
            items={[
              { label: "Tokens", value: tokenCount > 0 ? `${tokenCount} active` : "None yet" },
              { label: "Reveal", value: "Shown once" },
              { label: "Format", value: "Bearer token" }
            ]}
          />
        </article>

        <aside className="surface-panel surface-panel--form">
          <p className="panel-kicker">Create token</p>
          <h2>Name the script or tool.</h2>
          <p className="panel-copy">Use distinct names so revoking access later is obvious.</p>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              createTokenMutation.mutate(name.trim());
            }}
          >
            <label className="field">
              <span className="field__label">Token name</span>
              <input
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ops sync script"
                required
                value={name}
              />
              <span className="field__hint">The raw token is only visible at creation time.</span>
            </label>
            <button className="primary-button" disabled={createTokenMutation.isPending || name.trim().length === 0} type="submit">
              {createTokenMutation.isPending ? "Creating token..." : "Create token"}
            </button>
          </form>
        </aside>
      </section>

      {tokensQuery.error ? <ErrorBanner error={tokensQuery.error} /> : null}
      {createTokenMutation.error ? <ErrorBanner error={createTokenMutation.error} /> : null}
      {deleteTokenMutation.error ? <ErrorBanner error={deleteTokenMutation.error} /> : null}

      {revealedToken ? (
        <section className="token-reveal">
          <div className="token-reveal__copy">
            <p className="eyebrow">Copy now</p>
            <h2>This token will not be shown again.</h2>
            <p className="lead-copy">Store it in your CLI config or secret manager before leaving this page.</p>
          </div>
          <code>{revealedToken}</code>
        </section>
      ) : null}

      {tokensQuery.isPending ? <TokenListSkeleton /> : null}

      {!tokensQuery.isPending && tokensQuery.data && tokensQuery.data.length === 0 ? (
        <EmptyState
          copy="Create one when a local script, CLI, or small integration needs to call the bbtodo API."
          eyebrow="No tokens"
          title="You have not issued any API tokens yet."
        />
      ) : null}

      {!tokensQuery.isPending && tokensQuery.data && tokensQuery.data.length > 0 ? (
        <section className="token-list">
          {tokensQuery.data.map((token, index) => (
            <article className="token-row" key={token.id} style={itemStyle(index)}>
              <div className="token-row__copy">
                <div className="token-row__meta">
                  <span className="label-chip label-chip--soft">Created {formatDate(token.createdAt)}</span>
                  <span className="token-row__timestamp">
                    Last used {token.lastUsedAt ? formatDateTime(token.lastUsedAt) : "never"}
                  </span>
                </div>
                <h2>{token.name}</h2>
              </div>
              <button className="text-button danger-button" onClick={() => deleteTokenMutation.mutate(token.id)} type="button">
                Revoke
              </button>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function AuthenticatedApp() {
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe()
  });

  if (meQuery.isPending) {
    return <LoadingState />;
  }

  if (isApiError(meQuery.error, 401)) {
    return <LoginScreen />;
  }

  if (meQuery.error) {
    return (
      <main className="centered-state">
        <section className="hero-panel centered-panel">
          <p className="eyebrow">bbtodo</p>
          <h1>We hit a problem loading your workspace.</h1>
          <p className="lead-copy">The session may be stale or the server may still be starting up.</p>
          <ErrorBanner error={meQuery.error} />
        </section>
      </main>
    );
  }

  return <AppShell user={meQuery.data as User} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthenticatedApp />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
