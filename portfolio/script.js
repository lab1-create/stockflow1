const DEFAULT_PROJECTS = [
  {
    id: "stockflow-core",
    title: "StockFlow — Sistema Integrado de Estoque & Laboratório",
    category: "fullstack",
    categoryLabel: "Full-Stack · Produção",
    status: "🟢 Em Produção",
    description:
      "Sistema web completo desenvolvido para controle de insumos técnicos, fila de aprovação de retiradas em tempo real, rastreabilidade por técnico e bancada, devoluções e balanço físico auditável.",
    tags: ["Node.js", "PostgreSQL", "Supabase", "Express", "PWA", "Firebase Hosting"],
    link: "https://stockflow-outlet.web.app",
    linkLabel: "Acessar Sistema ↗"
  },
  {
    id: "stockflow-faturamento",
    title: "Módulo ERP Faturamento — Planilha Inteligente Web",
    category: "automacao",
    categoryLabel: "Automação & ERP",
    status: "🟢 Em Produção",
    description:
      "Transformação de planilha manual de controle de termos de garantia, embalagens e materiais de expedição em uma aplicação web com cálculo automático de entradas/saídas e alertas visuais (REPOR, ATENÇÃO, OK).",
    tags: ["JavaScript ES6+", "SQL Aggregations", "Automação de Estoque", "Exportação CSV"],
    link: "https://stockflow-outlet.web.app",
    linkLabel: "Ver Módulo em Produção ↗"
  },
  {
    id: "stockflow-api",
    title: "API RESTful Multi-Setor & Motor de Auditoria ACID",
    category: "backend",
    categoryLabel: "Backend & Segurança",
    status: "🟢 Em Produção",
    description:
      "Arquitetura backend com autenticação JWT + Cookies HttpOnly, hash Bcrypt, auto-migração de schema no boot, bloqueio de linha (FOR UPDATE) para evitar concorrência de saldo e rate-limiting.",
    tags: ["Node.js", "Express", "JWT", "Bcrypt", "PostgreSQL ACID", "Render Cloud"],
    link: "https://github.com/lab1-create/stockflow1",
    linkLabel: "Ver Arquitetura ↗"
  }
];

const SIMULATOR_ITEMS = [
  { code: "FAT-001", name: "Carregador Outlet - Micro USB", category: "Carregadores", unit: "un", init: 25, entries: 15, exits: 5, min: 20 },
  { code: "FAT-002", name: "Termo de garantia - 6 meses", category: "Documentos", unit: "un", init: 200, entries: 100, exits: 80, min: 200 },
  { code: "FAT-004", name: "Caixa para envio", category: "Embalagem", unit: "un", init: 80, entries: 40, exits: 55, min: 100 },
  { code: "FAT-005", name: "Fita gomada", category: "Embalagem", unit: "rolo", init: 8, entries: 4, exits: 2, min: 5 },
  { code: "FAT-012", name: "Chavinha de gaveta de chip (ejetor SIM)", category: "Ferramentas", unit: "un", init: 600, entries: 200, exits: 120, min: 500 },
  { code: "FAT-013", name: "Etiqueta térmica 100x150", category: "Impressão", unit: "rolo", init: 4, entries: 3, exits: 2, min: 5 }
];

const CATEGORY_COLORS = {
  Carregadores: "background:#ede9fe; color:#6d28d9; border:1px solid #c4b5fd;",
  Documentos: "background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd;",
  Embalagem: "background:#ffedd5; color:#c2410c; border:1px solid #fdba74;",
  Ferramentas: "background:#ccfbf1; color:#0f766e; border:1px solid #5eead4;",
  Impressão: "background:#fce7f3; color:#be185d; border:1px solid #f9a8d4;"
};

function getCustomProjects() {
  try {
    const raw = localStorage.getItem("luiz_portfolio_custom_projects");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomProject(proj) {
  const list = getCustomProjects();
  list.unshift(proj);
  localStorage.setItem("luiz_portfolio_custom_projects", JSON.stringify(list));
}

function getAllProjects() {
  return [...getCustomProjects(), ...DEFAULT_PROJECTS];
}

function computeStatus(qty, min) {
  if (qty <= min) {
    return {
      label: "🔴 REPOR",
      style: "background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;"
    };
  }
  if (qty <= min * 1.5) {
    return {
      label: "🟡 ATENÇÃO",
      style: "background:#fef3c7; color:#b45309; border:1px solid #fcd34d;"
    };
  }
  return {
    label: "🟢 OK",
    style: "background:#dcfce7; color:#15803d; border:1px solid #86efac;"
  };
}

function renderSimulatorTable() {
  const tbody = document.getElementById("sim-fat-tbody");
  if (!tbody) return;

  tbody.innerHTML = SIMULATOR_ITEMS.map((item, idx) => {
    const currentQty = Math.max(0, Number(item.init) + Number(item.entries) - Number(item.exits));
    const st = computeStatus(currentQty, Number(item.min));
    const catStyle = CATEGORY_COLORS[item.category] || "background:#e2e8f0; color:#334155;";
    return `
      <tr>
        <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:700;">${item.code}</code></td>
        <td><strong>${item.name}</strong></td>
        <td><span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:700; ${catStyle}">${item.category}</span></td>
        <td>${item.unit}</td>
        <td class="sim-yellow-cell">
          <input type="number" min="0" class="sim-yellow-input" data-sim-init="${idx}" value="${item.init}">
        </td>
        <td style="color:#059669; font-weight:700;">+${item.entries}</td>
        <td style="color:#dc2626; font-weight:700;">-${item.exits}</td>
        <td style="font-weight:800; font-size:0.95rem;">${currentQty} ${item.unit}</td>
        <td class="sim-yellow-cell">
          <input type="number" min="0" class="sim-yellow-input" data-sim-min="${idx}" value="${item.min}">
        </td>
        <td>
          <span style="padding:4px 10px; border-radius:999px; font-size:0.76rem; font-weight:700; display:inline-block; ${st.style}">
            ${st.label}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

function renderProjects(filter = "all") {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  const projects = getAllProjects().filter(p => filter === "all" || p.category === filter);

  grid.innerHTML = projects.map(p => `
    <article class="project-card">
      <div>
        <div class="proj-top">
          <span class="proj-cat">${p.categoryLabel}</span>
          <span class="proj-status">${p.status}</span>
        </div>
        <h3>${p.title}</h3>
        <p>${p.description}</p>
      </div>
      <div>
        <div class="tag-list">
          ${(p.tags || []).map(t => `<span>${t}</span>`).join("")}
        </div>
        <div class="proj-links">
          <a href="${p.link || '#'}" target="_blank" rel="noopener" class="proj-link">${p.linkLabel || 'Ver Detalhes ↗'}</a>
        </div>
      </div>
    </article>
  `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderSimulatorTable();
  renderProjects("all");

  // Interactive simulator cells
  const simTbody = document.getElementById("sim-fat-tbody");
  simTbody?.addEventListener("input", (e) => {
    const initInput = e.target.closest("[data-sim-init]");
    if (initInput) {
      const idx = Number(initInput.dataset.simInit);
      SIMULATOR_ITEMS[idx].init = Math.max(0, Number(initInput.value) || 0);
      renderSimulatorTable();
      const refocused = simTbody.querySelector(`[data-sim-init="${idx}"]`);
      refocused?.focus();
    }

    const minInput = e.target.closest("[data-sim-min]");
    if (minInput) {
      const idx = Number(minInput.dataset.simMin);
      SIMULATOR_ITEMS[idx].min = Math.max(0, Number(minInput.value) || 0);
      renderSimulatorTable();
      const refocused = simTbody.querySelector(`[data-sim-min="${idx}"]`);
      refocused?.focus();
    }
  });

  // Simulator tabs
  document.querySelectorAll("[data-sim-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.simTab;
      document.querySelectorAll("[data-sim-tab]").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".sim-panel").forEach(p => p.classList.toggle("active", p.id === `sim-panel-${target}`));
    });
  });

  // Project filter pills
  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === btn));
      renderProjects(btn.dataset.filter);
    });
  });

  // Copy LinkedIn post buttons
  document.querySelectorAll("[data-copy-post]").forEach(btn => {
    btn.addEventListener("click", () => {
      const postId = btn.dataset.copyPost;
      const pre = document.getElementById(postId);
      if (!pre) return;
      navigator.clipboard.writeText(pre.textContent).then(() => {
        const originalText = btn.textContent;
        btn.textContent = "✅ Copiado para o LinkedIn!";
        setTimeout(() => { btn.textContent = originalText; }, 2500);
      });
    });
  });

  // Copy Portfolio Link button
  const copyLinkBtn = document.getElementById("copy-portfolio-link-btn");
  copyLinkBtn?.addEventListener("click", () => {
    const url = window.location.href.startsWith("http")
      ? window.location.href
      : "https://stockflow-outlet.web.app/portfolio/";
    navigator.clipboard.writeText(url).then(() => {
      const orig = copyLinkBtn.textContent;
      copyLinkBtn.textContent = "✅ Link Copiado!";
      setTimeout(() => { copyLinkBtn.textContent = orig; }, 2500);
    });
  });

  // Add New Project Modal
  const dialog = document.getElementById("add-project-dialog");
  const openBtn = document.getElementById("open-add-project-btn");
  const closeBtn = document.getElementById("close-project-dialog");
  const form = document.getElementById("add-project-form");

  openBtn?.addEventListener("click", () => dialog?.showModal());
  closeBtn?.addEventListener("click", () => dialog?.close());

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("proj-title").value.trim();
    const category = document.getElementById("proj-category").value;
    const status = document.getElementById("proj-status").value.trim();
    const description = document.getElementById("proj-desc").value.trim();
    const tags = document.getElementById("proj-tags").value.split(",").map(s => s.trim()).filter(Boolean);
    const link = document.getElementById("proj-link").value.trim() || "https://stockflow-outlet.web.app";

    const catMap = {
      fullstack: "Full-Stack",
      automacao: "Automação & ERP",
      backend: "Backend & API"
    };

    saveCustomProject({
      id: "proj-" + Date.now(),
      title,
      category,
      categoryLabel: catMap[category] || "Projeto",
      status: "🟢 " + status,
      description,
      tags,
      link,
      linkLabel: "Acessar Projeto ↗"
    });

    form.reset();
    dialog?.close();
    renderProjects("all");
  });
});
