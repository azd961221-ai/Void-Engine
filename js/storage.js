const STORAGE_KEY = "void_projects";
const LAST_PROJECT_KEY = "void_last_project";

function getProjects() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function addProject(project) {
    const projects = getProjects();
    projects.push(project);
    saveProjects(projects);
}

function setLastProject(id) {
    localStorage.setItem(LAST_PROJECT_KEY, id);
}

function getLastProject() {
    return localStorage.getItem(LAST_PROJECT_KEY);
}
