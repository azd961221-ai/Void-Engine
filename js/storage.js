const STORAGE_KEY = "void_projects";
const LAST_PROJECT_KEY = "void_last_project";

function getProjects() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (err) {
        console.error("Failed to parse projects", err);
        return [];
    }
}

function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function addProject(project) {
    const projects = getProjects();
    const normalized = {
        createdAt: Date.now(),
        ...project,
    };
    projects.push(normalized);
    saveProjects(projects);
    setLastProject(normalized.id);
    return normalized;
}

function setLastProject(id) {
    localStorage.setItem(LAST_PROJECT_KEY, id);
}

function getLastProject() {
    return localStorage.getItem(LAST_PROJECT_KEY);
}
