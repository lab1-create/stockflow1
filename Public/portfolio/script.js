const DEFAULT_PROJECTS = [
  {
    id: "datasys-automove-rpa",
    title: "Robô DataSys AutoMove — Movimentação Automática por IMEI",
    category: "automacao",
    categoryLabel: "Robô de Automação (Python)",
    status: "🟢 Em Uso na Operação",
    description:
      "Robô que faz sozinho a transferência de centenas de celulares por código IMEI dentro do sistema DataSys. O operador apenas cola a lista de códigos e o robô abre o navegador, baixa a base de estoque, protege códigos com zero inicial e transfere tudo em segundos gerando uma planilha Excel no final.",
    tags: ["Python", "Automação de Navegador", "Planilhas Excel", "Painel Web"],
    link: "#video-robo",
    linkLabel: "🎬 Assistir Vídeo do Robô Acima ↑"
  },
  {
    id: "stockflow-core",
    title: "StockFlow — Controle de Peças da Assistência Técnica",
    category: "fullstack",
    categoryLabel: "Sistema Web",
    status: "🟢 Online em Produção",
    description:
      "Sistema com visual Vermelho Dark Sofisticado para o laboratório técnico. Cada técnico solicita ou devolve peças pelo próprio login, o administrador libera com 1 clique, faz a contagem física da prateleira e sabe exatamente com quem está cada insumo.",
    tags: ["Node.js", "Banco de Dados", "Celular & Computador"],
    link: "https://stockflow-outlet.web.app",
    linkLabel: "Abrir Sistema Online ↗"
  },
  {
    id: "stockflow-faturamento",
    title: "StockFlow Faturamento — Planilha Automática na Web",
    category: "automacao",
    categoryLabel: "Controle de Expedição",
    status: "🟢 Online em Produção",
    description:
      "Tela criada especialmente para o setor de Faturamento controlar caixas, sacolas, etiquetas e termos de garantia. Soma entradas e saídas sozinha e muda o alerta automaticamente com cores (🔴 REPOR, 🟡 ATENÇÃO e 🟢 OK).",
    tags: ["JavaScript", "Alertas Automáticos", "Exportação Excel/CSV"],
    link: "https://stockflow-outlet.web.app",
    linkLabel: "Ver Sistema Online ↗"
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

function renderProjects() {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  const projects = getAllProjects();

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
          <a href="${p.link || '#'}" ${String(p.link || '').startsWith('http') ? 'target="_blank" rel="noopener"' : ''} class="proj-link">${p.linkLabel || 'Ver Projeto ↗'}</a>
        </div>
      </div>
    </article>
  `).join("");
}

// =========================================================================
// PLAYER DE VÍDEO ANIMADO DO ROBÔ DATASYS (4 CENAS AUTOMÁTICAS)
// =========================================================================
let currentVideoScene = 0;
const totalVideoScenes = 4;
let isVideoPlaying = true;
let videoTimer = null;

function showVideoScene(index) {
  currentVideoScene = (index + totalVideoScenes) % totalVideoScenes;

  document.querySelectorAll(".v-scene").forEach(sc => {
    sc.classList.toggle("active", Number(sc.dataset.scene) === currentVideoScene);
  });

  document.querySelectorAll("[data-goto-scene]").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.gotoScene) === currentVideoScene);
  });

  const fill = document.getElementById("video-progress-fill");
  if (fill) {
    fill.style.width = `${((currentVideoScene + 1) / totalVideoScenes) * 100}%`;
  }

  const label = document.getElementById("video-scene-indicator");
  if (label) {
    label.textContent = `Passo ${currentVideoScene + 1} de ${totalVideoScenes}`;
  }
}

function startVideoLoop() {
  clearInterval(videoTimer);
  videoTimer = setInterval(() => {
    if (isVideoPlaying) {
      showVideoScene(currentVideoScene + 1);
    }
  }, 4200);
}

document.addEventListener("DOMContentLoaded", () => {
  renderSimulatorTable();
  renderProjects();
  showVideoScene(0);
  startVideoLoop();

  // Botões de cena do vídeo
  document.querySelectorAll("[data-goto-scene]").forEach(btn => {
    btn.addEventListener("click", () => {
      showVideoScene(Number(btn.dataset.gotoScene));
      startVideoLoop();
    });
  });

  // Botão Play / Pause do vídeo
  const playPauseBtn = document.getElementById("video-play-pause-btn");
  playPauseBtn?.addEventListener("click", () => {
    isVideoPlaying = !isVideoPlaying;
    playPauseBtn.textContent = isVideoPlaying ? "⏸ Pausar Vídeo" : "▶ Continuar Vídeo";
  });

  // Clique na barra de progresso do vídeo
  const track = document.getElementById("video-progress-track");
  track?.addEventListener("click", (e) => {
    const rect = track.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const targetScene = Math.min(totalVideoScenes - 1, Math.max(0, Math.floor(pct * totalVideoScenes)));
    showVideoScene(targetScene);
    startVideoLoop();
  });

  // Células amarelas da planilha de faturamento
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

  // Abas do StockFlow
  document.querySelectorAll("[data-sim-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.simTab;
      document.querySelectorAll("[data-sim-tab]").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".sim-panel").forEach(p => p.classList.toggle("active", p.id === `sim-panel-${target}`));
    });
  });

  // Copiar Posts do LinkedIn
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

  // Copiar Link do Portfólio
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

  // Modal Adicionar Novo Projeto
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
      fullstack: "Sistema Web",
      automacao: "Robô / Automação"
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
    renderProjects();
  });
});
