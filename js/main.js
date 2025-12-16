createProjectBtn.onclick = openModal;
heroCreateBtn.onclick = openModal;
cancelBtn.onclick = closeModal;

function validateNumberInput(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
}

confirmBtn.onclick = () => {
    const projectNameValue = projectName.value.trim();
    if (!projectNameValue) return;

    const project = {
        id: crypto.randomUUID(),
        name: projectNameValue,
        type: projectType.value,
        platform: projectPlatform.value,
        width: validateNumberInput(canvasWidth.value, 1280),
        height: validateNumberInput(canvasHeight.value, 720),
    };

    const savedProject = addProject(project);
    closeModal();
    renderProjects();
    setLastProject(savedProject.id);
};

searchInput.oninput = e =>
    renderProjects(e.target.value, sortSelect.value);

sortSelect.onchange = e =>
    renderProjects(searchInput.value, e.target.value);

openLastBtn.onclick = () => {
    const lastId = getLastProject();
    if (lastId) {
        window.location.href = `editor.html?project=${lastId}`;
    }
};

renderProjects();
