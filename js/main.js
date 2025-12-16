createProjectBtn.onclick = openModal;
heroCreateBtn.onclick = openModal;
cancelBtn.onclick = closeModal;

confirmBtn.onclick = () => {
    const project = {
        id: crypto.randomUUID(),
        name: projectName.value.trim(),
        type: projectType.value,
        platform: projectPlatform.value,
        width: +canvasWidth.value,
        height: +canvasHeight.value,
        createdAt: Date.now()
    };

    if (!project.name) return;

    addProject(project);
    closeModal();
    renderProjects();
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
