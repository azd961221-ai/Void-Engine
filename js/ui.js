const projectsGrid = document.getElementById("projectsGrid");
const emptyState = document.getElementById("emptyState");

const totalCount = document.getElementById("totalCount");
const count2D = document.getElementById("count2D");
const count3D = document.getElementById("count3D");

function openEditor(projectId) {
    setLastProject(projectId);
    window.location.href = `editor.html?project=${projectId}`;
}

function renderProjects(filter = "", sort = "date") {
    let projects = getProjects();

    totalCount.textContent = projects.length;
    count2D.textContent = projects.filter(p => p.type === "2D").length;
    count3D.textContent = projects.filter(p => p.type === "3D").length;

    if (filter) {
        projects = projects.filter(p =>
            p.name.toLowerCase().includes(filter.toLowerCase())
        );
    }

    if (sort === "name") {
        projects.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        projects.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }

    projectsGrid.innerHTML = "";
    emptyState.style.display = projects.length ? "none" : "block";

    projects.forEach(p => {
        const card = document.createElement("div");
        card.className = "project-card";

        card.innerHTML = `
            <div class="project-preview"></div>
            <div class="project-name">${p.name}</div>
            <div class="project-meta">
                ${p.type} • ${p.platform}<br>
                ${p.width}×${p.height}
            </div>
        `;

        card.onclick = () => openEditor(p.id);
        projectsGrid.appendChild(card);
    });
}

function openModal() {
    modal.classList.add("active");
}

function closeModal() {
    modal.classList.remove("active");
}
