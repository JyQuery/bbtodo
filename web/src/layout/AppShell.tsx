import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams
} from "react-router-dom";

import { api, type TaskTag, type User } from "../api";
import { defaultTaskTagColor, getTaskTagStyle } from "../app/tag-colors";
import { themeOptions } from "../app/constants";
import { formatTagInput, getAvatarLetter, normalizeTagKey, parseTagInput } from "../app/utils";
import { ChevronDownIcon, CloseIcon, ErrorBanner, PencilIcon } from "../components/ui";
import { useDismissableLayer } from "../hooks/useDismissableLayer";

export function AppShell({ user }: { user: User }) {
  const location = useLocation();
  const navigate = useNavigate();
  const boardMatch = useMatch("/projects/:projectId");
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = useState(false);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [projectSwitcherInput, setProjectSwitcherInput] = useState("");
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const projectSwitcherRef = useRef<HTMLDivElement | null>(null);
  const tagFilterRef = useRef<HTMLDivElement | null>(null);
  const tagFilterInputRef = useRef<HTMLInputElement | null>(null);
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
    enabled: Boolean(boardMatch)
  });
  const taskTagsQuery = useQuery({
    queryKey: ["task-tags"],
    queryFn: () => api.listTaskTags(),
    enabled: Boolean(boardMatch)
  });
  const createProjectMutation = useMutation({
    mutationFn: (name: string) => api.createProject(name),
    onSuccess: async (project) => {
      setIsProjectSwitcherOpen(false);
      setProjectSwitcherInput("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      startTransition(() => {
        navigate(`/projects/${project.id}`);
      });
    }
  });
  const renameProjectMutation = useMutation({
    mutationFn: ({ name, projectId }: { name: string; projectId: string }) =>
      api.updateProject(projectId, { name }),
    onSuccess: async () => {
      setIsProjectSwitcherOpen(false);
      setProjectSwitcherInput("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });
  const themeMutation = useMutation({
    mutationFn: api.updateTheme,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["me"], updatedUser);
    }
  });
  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      window.location.replace("/");
    }
  });
  const avatarLetter = getAvatarLetter(user);
  const isProjectsRoute = location.pathname === "/";
  const navSearch = boardMatch || isProjectsRoute ? searchParams.get("q") ?? "" : "";
  const navTagSearch = boardMatch ? searchParams.get("tags") ?? "" : "";
  const availableTagFilters = taskTagsQuery.data ?? [];
  const availableTagFilterMap = useMemo(
    () => new Map(availableTagFilters.map((tag) => [normalizeTagKey(tag.label), tag])),
    [availableTagFilters]
  );
  const availableTagFilterKeys = useMemo(
    () => new Set(availableTagFilters.map((tag) => normalizeTagKey(tag.label))),
    [availableTagFilters]
  );
  const hasTagFilterTrailingSeparator = /,\s*$/.test(navTagSearch);
  const tagFilterSegments = navTagSearch.split(",");
  const tagFilterDraftValue = tagFilterSegments.at(-1) ?? "";
  const tagFilterDraftKey = normalizeTagKey(tagFilterDraftValue);
  const hasTagFilterDraft =
    !hasTagFilterTrailingSeparator &&
    tagFilterDraftKey.length > 0 &&
    !availableTagFilterKeys.has(tagFilterDraftKey);
  const committedTagFilterInput = hasTagFilterDraft
    ? tagFilterSegments.slice(0, -1).join(",")
    : navTagSearch;
  const committedTagFilters = useMemo(
    () => parseTagInput(committedTagFilterInput),
    [committedTagFilterInput]
  );
  const selectedTagFilterChips = useMemo(
    () =>
      committedTagFilters.map((label) => ({
        color: availableTagFilterMap.get(normalizeTagKey(label))?.color ?? defaultTaskTagColor,
        label
      })),
    [availableTagFilterMap, committedTagFilters]
  );
  const committedTagFilterKeys = useMemo(
    () => new Set(committedTagFilters.map((tag) => normalizeTagKey(tag))),
    [committedTagFilters]
  );
  const tagFilterInputValue = hasTagFilterDraft ? tagFilterDraftValue.trimStart() : "";
  const visibleTagFilterOptions = useMemo(
    () =>
      availableTagFilters.filter((tag) => {
        const key = normalizeTagKey(tag.label);
        if (committedTagFilterKeys.has(key)) {
          return false;
        }

        return !hasTagFilterDraft || key.includes(tagFilterDraftKey);
      }),
    [availableTagFilters, committedTagFilterKeys, hasTagFilterDraft, tagFilterDraftKey]
  );
  const activeProject =
    boardMatch && projectsQuery.data
      ? projectsQuery.data.find((project) => project.id === boardMatch.params.projectId) ?? null
      : null;
  const deferredProjectSwitcherInput = useDeferredValue(projectSwitcherInput.trim().toLowerCase());
  const visibleProjects = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    if (!deferredProjectSwitcherInput) {
      return projects;
    }

    return projects.filter((project) =>
      project.name.toLowerCase().includes(deferredProjectSwitcherInput)
    );
  }, [deferredProjectSwitcherInput, projectsQuery.data]);
  const hasProjectInput = projectSwitcherInput.trim().length > 0;
  const isProjectMutationPending =
    createProjectMutation.isPending || renameProjectMutation.isPending;

  useDismissableLayer(isMenuOpen, menuRef, () => setIsMenuOpen(false));
  useDismissableLayer(isProjectSwitcherOpen, projectSwitcherRef, () => setIsProjectSwitcherOpen(false));
  useDismissableLayer(isTagFilterOpen, tagFilterRef, () => setIsTagFilterOpen(false));

  useEffect(() => {
    if (isProjectSwitcherOpen) {
      return;
    }

    setProjectSwitcherInput("");
    createProjectMutation.reset();
    renameProjectMutation.reset();
  }, [isProjectSwitcherOpen]);

  useEffect(() => {
    if (boardMatch) {
      return;
    }

    setIsTagFilterOpen(false);
  }, [boardMatch]);

  function updateRouteParams(updater: (params: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(searchParams);
    updater(nextParams);
    setSearchParams(nextParams, { replace: true });
  }

  function openProject(projectId: string) {
    setIsProjectSwitcherOpen(false);
    setProjectSwitcherInput("");
    startTransition(() => {
      navigate(`/projects/${projectId}`);
    });
  }

  function composeTagFilterValue(tags: string[], draftValue: string) {
    const nextTags = formatTagInput(tags);
    const nextDraft = draftValue.trimStart();

    if (nextTags && nextDraft) {
      return `${nextTags}, ${nextDraft}`;
    }

    return nextTags || nextDraft;
  }

  function updateTagFilterSearch(draftValue: string) {
    updateRouteParams((params) => {
      const nextValue = composeTagFilterValue(committedTagFilters, draftValue);
      if (nextValue.trim()) {
        params.set("tags", nextValue);
      } else {
        params.delete("tags");
      }
    });
  }

  function removeTagFilter(tagToRemove: string) {
    const nextTags = committedTagFilters.filter(
      (tag) => normalizeTagKey(tag) !== normalizeTagKey(tagToRemove)
    );

    updateRouteParams((params) => {
      const nextValue = composeTagFilterValue(nextTags, tagFilterInputValue);
      if (nextValue.trim()) {
        params.set("tags", nextValue);
      } else {
        params.delete("tags");
      }
    });

    setIsTagFilterOpen(true);
    window.requestAnimationFrame(() => {
      tagFilterInputRef.current?.focus();
    });
  }

  function selectTagFilter(tag: TaskTag) {
    const nextTags = committedTagFilters.some(
      (selectedTag) => normalizeTagKey(selectedTag) === normalizeTagKey(tag.label)
    )
      ? committedTagFilters
      : [...committedTagFilters, tag.label];

    updateRouteParams((params) => {
      const nextValue = composeTagFilterValue(nextTags, "");
      if (nextValue) {
        params.set("tags", nextValue);
      } else {
        params.delete("tags");
      }
    });

    setIsTagFilterOpen(true);
    window.requestAnimationFrame(() => {
      tagFilterInputRef.current?.focus();
    });
  }

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
              <div className="subnav__cluster subnav__cluster--primary">
                <NavLink className={({ isActive }) => `subnav__link${isActive ? " is-active" : ""}`} end to="/">
                  Projects
                </NavLink>
                {activeProject ? (
                  <div className="project-switcher" ref={projectSwitcherRef}>
                    <button
                      aria-expanded={isProjectSwitcherOpen}
                      aria-haspopup="dialog"
                      aria-label="Open project switcher"
                      className="subnav__current subnav__current--button"
                      onClick={() => setIsProjectSwitcherOpen((current) => !current)}
                      title={activeProject.name}
                      type="button"
                    >
                      <span className="subnav__current-copy">
                        <span className="subnav__current-value">{activeProject.name}</span>
                      </span>
                      <ChevronDownIcon
                        className={`project-switcher__chevron${isProjectSwitcherOpen ? " is-open" : ""}`}
                      />
                    </button>
                    {isProjectSwitcherOpen ? (
                      <div
                        aria-label="Project switcher"
                        className="project-switcher__dropdown"
                        role="dialog"
                      >
                        <label className="project-switcher__field">
                          <input
                            aria-label="Project switcher input"
                            onChange={(event) => setProjectSwitcherInput(event.target.value)}
                            placeholder="Search or enter a project name"
                            value={projectSwitcherInput}
                          />
                        </label>
                        <div className="project-switcher__actions">
                          <button
                            className="project-switcher__quick-action"
                            disabled={!hasProjectInput || isProjectMutationPending}
                            onClick={() => createProjectMutation.mutate(projectSwitcherInput.trim())}
                            type="button"
                          >
                            <span aria-hidden="true" className="project-switcher__quick-mark">
                              +
                            </span>
                            <span>Create Project</span>
                          </button>
                          <button
                            className="project-switcher__quick-action project-switcher__quick-action--secondary"
                            disabled={!activeProject || !hasProjectInput || isProjectMutationPending}
                            onClick={() => {
                              if (!activeProject) {
                                return;
                              }

                              renameProjectMutation.mutate({
                                name: projectSwitcherInput.trim(),
                                projectId: activeProject.id
                              });
                            }}
                            type="button"
                          >
                            <PencilIcon />
                            <span>Rename Project</span>
                          </button>
                        </div>
                        {projectsQuery.error ? <ErrorBanner error={projectsQuery.error} /> : null}
                        {createProjectMutation.error ? <ErrorBanner error={createProjectMutation.error} /> : null}
                        {renameProjectMutation.error ? <ErrorBanner error={renameProjectMutation.error} /> : null}
                        <div className="project-switcher__list">
                          {projectsQuery.isPending ? (
                            <p className="project-switcher__empty">Loading projects...</p>
                          ) : visibleProjects.length > 0 ? (
                            visibleProjects.map((project) => (
                              <button
                                aria-current={project.id === activeProject.id ? "page" : undefined}
                                aria-label={`Open project ${project.name}`}
                                className={`project-switcher__item${project.id === activeProject.id ? " is-active" : ""}`}
                                key={project.id}
                                onClick={() => openProject(project.id)}
                                type="button"
                              >
                                <span className="project-switcher__item-name">{project.name}</span>
                                {project.id === activeProject.id ? (
                                  <span className="project-switcher__item-meta">Current</span>
                                ) : null}
                              </button>
                            ))
                          ) : (
                            <p className="project-switcher__empty">No projects match that input yet.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {boardMatch || isProjectsRoute ? (
                <div className="subnav__cluster subnav__cluster--tools">
                  <label className="subnav__search">
                    <input
                      aria-label={isProjectsRoute ? "Search projects" : "Search cards"}
                      onChange={(event) =>
                        updateRouteParams((params) => {
                          const value = event.target.value.trim();
                          if (value) {
                            params.set("q", value);
                          } else {
                            params.delete("q");
                          }
                        })
                      }
                      placeholder={isProjectsRoute ? "Search projects" : "Search cards"}
                      type="search"
                      value={navSearch}
                    />
                  </label>
                  {boardMatch ? (
                    <div className="subnav__search subnav__search--tag-filter" ref={tagFilterRef}>
                      <div
                        className={`subnav__search-combo${isTagFilterOpen ? " is-open" : ""}`}
                        onClick={() => {
                          setIsTagFilterOpen(true);
                          tagFilterInputRef.current?.focus();
                        }}
                        role="presentation"
                      >
                        <div className="subnav__tag-filter-field">
                          {selectedTagFilterChips.map((tag) => (
                            <span
                              className="subnav__tag-filter-chip"
                              key={tag.label}
                              style={getTaskTagStyle(tag.color)}
                            >
                              <span aria-hidden="true" className="subnav__tag-filter-chip-swatch" />
                              <span className="subnav__tag-filter-chip-label">{tag.label}</span>
                              <button
                                aria-label={`Remove tag filter ${tag.label}`}
                                className="subnav__tag-filter-chip-remove"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeTagFilter(tag.label);
                                }}
                                type="button"
                              >
                                <CloseIcon />
                              </button>
                            </span>
                          ))}
                        <input
                          aria-controls="tag-filter-dropdown"
                          aria-expanded={isTagFilterOpen}
                          aria-label="Filter by tags"
                          onChange={(event) => {
                            setIsTagFilterOpen(true);
                            updateTagFilterSearch(event.target.value);
                          }}
                          onFocus={() => setIsTagFilterOpen(true)}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setIsTagFilterOpen(true);
                            }

                            if (event.key === "Escape") {
                              setIsTagFilterOpen(false);
                            }

                            if (
                              (event.key === "Backspace" || event.key === "Delete") &&
                              tagFilterInputValue.length === 0 &&
                              committedTagFilters.length > 0
                            ) {
                              event.preventDefault();
                              removeTagFilter(committedTagFilters.at(-1) ?? "");
                            }
                          }}
                          placeholder={selectedTagFilterChips.length > 0 ? "Add tag" : "tags"}
                          ref={tagFilterInputRef}
                          type="search"
                          value={tagFilterInputValue}
                        />
                        </div>
                        <button
                          aria-expanded={isTagFilterOpen}
                          aria-label="Show tag filter suggestions"
                          className="subnav__search-toggle"
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsTagFilterOpen((current) => !current);
                            tagFilterInputRef.current?.focus();
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          type="button"
                        >
                          <ChevronDownIcon className={`project-switcher__chevron${isTagFilterOpen ? " is-open" : ""}`} />
                        </button>
                      </div>
                      {isTagFilterOpen ? (
                        <div
                          aria-label="Available tag filters"
                          className="subnav__search-dropdown"
                          id="tag-filter-dropdown"
                          role="list"
                        >
                          {taskTagsQuery.error ? <ErrorBanner error={taskTagsQuery.error} /> : null}
                          {!taskTagsQuery.error ? (
                            taskTagsQuery.isPending ? (
                              <p className="subnav__search-empty">Loading tags...</p>
                            ) : visibleTagFilterOptions.length > 0 ? (
                              <div className="subnav__tag-option-list">
                                {visibleTagFilterOptions.map((tag) => (
                                  <button
                                    aria-label={`Add tag filter ${tag.label}`}
                                    className="subnav__tag-option"
                                    key={tag.label}
                                    onClick={() => selectTagFilter(tag)}
                                    style={getTaskTagStyle(tag.color)}
                                    type="button"
                                  >
                                    <span aria-hidden="true" className="subnav__tag-option-swatch" />
                                    <span>{tag.label}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="subnav__search-empty">
                                {availableTagFilters.length === 0
                                  ? "No reusable tags yet."
                                  : "No tags match that input."}
                              </p>
                            )
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {boardMatch ? (
                    <button
                      className="subnav__action"
                      onClick={() =>
                        updateRouteParams((params) => {
                          params.set("createLane", "1");
                        })
                      }
                      type="button"
                    >
                      <span aria-hidden="true" className="subnav__action-mark">
                        +
                      </span>
                      <span>Create Lane</span>
                    </button>
                  ) : null}
                  {isProjectsRoute ? (
                    <Link className="subnav__action" to="/?createProject=1">
                      <span aria-hidden="true" className="subnav__action-mark">
                        +
                      </span>
                      <span>Create Project</span>
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </nav>
          </div>

          <div className="topbar__meta">
            <div className="avatar-menu" ref={menuRef}>
              <button
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
                className="avatar-button"
                onClick={() => setIsMenuOpen((current) => !current)}
                type="button"
              >
                <span aria-hidden="true" className="avatar-button__letter">
                  {avatarLetter}
                </span>
              </button>
              {isMenuOpen ? (
                <div className="avatar-dropdown" role="menu">
                  <div className="menu-section">
                    <p className="menu-section__label">Theme</p>
                    <div className="theme-picker" role="group" aria-label="Theme switcher">
                      {themeOptions.map((themeOption) => (
                        <button
                          aria-pressed={user.theme === themeOption.id}
                          className={`theme-option${user.theme === themeOption.id ? " is-active" : ""}`}
                          disabled={themeMutation.isPending}
                          key={themeOption.id}
                          onClick={() => themeMutation.mutate(themeOption.id)}
                          type="button"
                        >
                          <span className={`theme-option__swatch theme-option__swatch--${themeOption.id}`} />
                          <span className="theme-option__copy">
                            <strong>{themeOption.label}</strong>
                          </span>
                        </button>
                      ))}
                    </div>
                    {themeMutation.error ? <ErrorBanner error={themeMutation.error} /> : null}
                  </div>
                  <Link
                    className="menu-item"
                    onClick={() => setIsMenuOpen(false)}
                    role="menuitem"
                    to="/settings/api-tokens"
                  >
                    API tokens
                  </Link>
                  <button
                    className="menu-item danger-button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      logoutMutation.mutate();
                    }}
                    role="menuitem"
                    type="button"
                  >
                    {logoutMutation.isPending ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="shell-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
