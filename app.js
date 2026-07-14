const API_BASE = "/api";
// Estado interno do App - Alinhado perfeitamente com os ID's do seu HTML
let state = {
    users: [],
    technicians: [],
    destinations: ["Bancada 01", "Bancada 02", "Bancada 03", "Laboratório"],
    items: [],
    history: [],
    requests: [],
    usageKpis: []
};

let currentUser = null;
let currentView = "dashboard";
let withdraw = { step: 0, technician: "", destination: "", item: null, qty: 1 };
let refreshTimer = null;

// Atalhos seletores do DOM
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

// Gerenciador de requisições para a API do Render
async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erro na comunicação com o servidor.");
    return data;
}

// Inicializar dados do Supabase através do backend
async function bootstrapApp() {
    try {
        const data = await apiRequest("/bootstrap");
        
        // Mapeando "supplies" do banco para "items" que o frontend espera
        state.items = (data.supplies || []).map(s => ({
            ...s,
            qty: s.current_quantity || 0,
            min: s.min_quantity || 0,
            supplier: s.supplier || "",
            note: s.note || ""
        }));

        // Mapeando "movements" do banco para "history" que o frontend espera
        state.history = (data.movements || []).map(m => ({
            id: m.id,
            user: m.user_name || "Sistema",
            type: m.movement_type === 'withdrawal' ? 'Retirada' : (m.movement_type === 'replenishment' ? 'Reposição' : 'Devolução'),
            itemCode: m.code,
            itemName: m.supply_name,
            qty: m.quantity,
            destination: m.dest_name || "-",
            at: m.created_at,
            note: m.note || ""
        }));

        // Mapeando "requests" para o formato esperado pelo frontend
        state.requests = (data.requests || []).map(r => ({
            id: r.id,
            technician: r.user_name || "Desconhecido",
            qty: r.quantity || 1,
            itemName: r.supply_name || "Insumo Desconhecido",
            status: r.status
        }));
        
        // Mapeando "users" para a lista de nomes dos "technicians"
        state.technicians = (data.users || []).map(u => u.name);
        
        if (data.destinations && data.destinations.length > 0) {
            state.destinations = data.destinations;
        }

        state.usageKpis = data.usageKpis || [];

        renderAll();
    } catch (err) {
        console.error("Erro ao sincronizar com banco:", err);
    }
}

function isAdmin() {
    return currentUser?.role === "admin";
}

function normalize(value) {
    return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

// Filtros de busca integrados com a sua barra de pesquisa topbar
function filteredItems() {
    const query = normalize($("#global-search")?.value || "");
    if (!query) return state.items;
    return state.items.filter(item =>
        [item.code, item.name, item.category, item.supplier].some(f => normalize(f).includes(query))
    );
}

function filteredHistory() {
    const query = normalize($("#global-search")?.value || "");
    const technician = isAdmin() ? ($("#technician-filter")?.value || "") : currentUser.name;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return state.history.filter(entry => {
        const matchesSearch = !query || [entry.user, entry.type, entry.itemName, entry.itemCode].some(f => normalize(f).includes(query));
        const matchesTech = !technician || entry.user === technician;
        const matchesDate = isAdmin() || new Date(entry.at) >= sevenDaysAgo;
        return matchesSearch && matchesTech && matchesDate;
    });
}

// Alternador de Telas (Views) respeitando suas marcações CSS
function setView(view) {
    if (!isAdmin() && ["dashboard", "replenish", "items"].includes(view)) {
        view = "withdraw";
    }
    currentView = view;
    $$(".view").forEach(node => node.classList.toggle("active", node.id === `${view}-view`));
    $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));

    const titleMap = {
        dashboard: "Dashboard",
        withdraw: "Retirar Insumo",
        return: "Devolver Insumo",
        replenish: "Repor Estoque",
        items: "Insumos",
        history: "Histórico Completo"
    };
    if ($("#view-title")) $("#view-title").textContent = titleMap[view] || "Dashboard";

    if (view === "withdraw") {
        withdraw = { step: isAdmin() ? 0 : 2, technician: isAdmin() ? "" : currentUser.name, destination: state.destinations[0], item: null, qty: 1 };
        renderWithdraw();
    }
    renderAll();
}

// Renderização geral dos painéis e KPIs do seu Dashboard
function renderAll() {
    const criticalItems = state.items.filter(i => Number(i.qty) <= Number(i.min));

    if ($("#metric-total-items")) $("#metric-total-items").textContent = state.items.length;
    if ($("#metric-critical")) $("#metric-critical").textContent = criticalItems.length;
    if ($("#metric-withdrawals")) $("#metric-withdrawals").textContent = state.history.filter(h => h.type === "Retirada").length;
    if ($("#metric-stock")) $("#metric-stock").textContent = state.items.reduce((acc, i) => acc + Number(i.qty), 0);

    // Lista de Itens Críticos
    const critList = $("#critical-list");
    if (critList) {
        critList.innerHTML = criticalItems.length
            ? criticalItems.map(i => `<div class="compact-row"><span>${i.name}</span><strong>${i.qty}/${i.min} un</strong></div>`).join("")
            : `<p class="muted">Nenhum item crítico.</p>`;
    }

    // Lista de solicitações em tempo real
    const pendingRequests = state.requests.filter(r => r.status === "pending");
    if ($("#pending-count")) $("#pending-count").textContent = `${pendingRequests.length} pendentes`;

    const reqList = $("#pending-requests");
    if (reqList) {
        reqList.innerHTML = pendingRequests.length
            ? pendingRequests.map(r => `
          <div class="request-card" style="padding:10px; border:1px solid #444; margin-bottom:8px; border-radius:4px;">
            <p><strong>${r.technician}</strong> quer retirar ${r.qty}x ${r.itemName}</p>
            <button class="primary-action" data-approve="${r.id}" style="margin-top:5px;">Liberar</button>
          </div>
        `).join("")
            : `<p class="muted">Nenhuma solicitação pendente.</p>`;

        $$("[data-approve]").forEach(btn => btn.addEventListener("click", () => approveRequest(btn.dataset.approve, btn)));
    }

    const myReqList = $("#my-pending-requests");
    if (myReqList) {
        const myRequests = pendingRequests.filter(r => r.technician === currentUser?.name);
        myReqList.innerHTML = myRequests.length
            ? myRequests.map(r => `
          <div class="request-card" style="padding:10px; border:1px solid #444; margin-bottom:8px; border-radius:4px; display: flex; justify-content: space-between; align-items: center;">
            <p style="margin: 0;">Aguardando <strong>${r.qty}x ${r.itemName}</strong>...</p>
            <button class="danger-action" data-cancel="${r.id}" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid #ff4444; background: transparent; color: #ff4444; cursor: pointer;">Cancelar</button>
          </div>
        `).join("")
            : `<p class="muted">Você não tem solicitações em andamento.</p>`;

        $$("[data-cancel]").forEach(btn => btn.addEventListener("click", () => cancelRequest(btn.dataset.cancel, btn)));
    }

    // Últimas movimentações
    const recHist = $("#recent-history");
    if (recHist) {
        const data = filteredHistory().slice(0, 5);
        recHist.innerHTML = data.length
            ? `<div class="table-body">` + data.map(h => `<div class="table-row"><span>${h.itemName}</span><span>${h.user}</span><span>${h.type}</span><span>${formatDate(h.at)}</span></div>`).join("") + `</div>`
            : `<p class="muted">Nenhum registro.</p>`;
    }

    renderItemsGrid();
    renderHistoryTable();
    renderTechnicianFilter();
}

// Grid de Insumos da Tela de Insumos
function renderItemsGrid() {
    const grid = $("#items-grid");
    if (!grid) return;
    grid.innerHTML = filteredItems().map(i => `
    <div class="item-card" style="padding:15px; border:1px solid #444; border-radius:4px; background:#1e1e1e;">
      <h3>${i.name}</h3>
      <p class="muted">Código: ${i.code} | Categoria: ${i.category}</p>
      <p>Estoque: <strong>${i.qty}</strong> (Mínimo: ${i.min})</p>
      <button class="ghost-action" data-edit-item="${i.code}" style="margin-top:8px;">Editar</button>
    </div>
  `).join("");

    $$("[data-edit-item]").forEach(btn => btn.addEventListener("click", () => openItemDialog(btn.dataset.editItem)));
}

// Tabela da Tela Histórico Completo
function renderHistoryTable() {
    const table = $("#history-table");
    if (!table) return;
    table.innerHTML = filteredHistory().map(h => `
    <div class="table-row">
      <span><strong>${h.itemName}</strong> (${h.itemCode})</span>
      <span>Técnico: ${h.user}</span>
      <span>${h.type} (${h.qty} un)</span>
      <span class="muted">${formatDate(h.at)}</span>
    </div>
  `).join("");
}

function renderTechnicianFilter() {
    const select = $("#technician-filter");
    if (!select || select.options.length > 1) return;
    state.technicians.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        select.appendChild(opt);
    });
}

// Fluxo de Retirada Dinâmico dentro do seu contêiner original
function renderWithdraw() {
    const content = $("#withdraw-content");
    if (!content) return;

    if (withdraw.step === 0) {
        content.innerHTML = `
      <h3>Quem vai retirar?</h3>
      <div class="form-grid" style="margin-top:10px;">
        ${state.technicians.map(t => `<button class="primary-action" data-select-tech="${t}">${t}</button>`).join("")}
      </div>
    `;
        $$("[data-select-tech]").forEach(b => b.addEventListener("click", () => { withdraw.technician = b.dataset.selectTech; withdraw.step = 2; renderWithdraw(); }));
        return;
    }

    if (withdraw.step === 2) {
        content.innerHTML = `
      <h3>Bipe o Insumo</h3>
      <div class="scan-row" style="margin-top:10px;">
        <input id="withdraw-code-input" class="scan-input" placeholder="Código do insumo">
        <button id="withdraw-find-btn" class="primary-action">Identificar</button>
      </div>
    `;
        const findItemAction = () => {
            const item = state.items.find(i => normalize(i.code) === normalize($("#withdraw-code-input").value));
            if (!item) return alert("Insumo não encontrado!");
            withdraw.item = item; withdraw.step = 3; renderWithdraw();
        };
        $("#withdraw-find-btn").addEventListener("click", findItemAction);
        $("#withdraw-code-input").addEventListener("keydown", (e) => { if (e.key === "Enter") findItemAction(); });
        return;
    }

    if (withdraw.step === 3) {
        content.innerHTML = `
      <h3>Confirmar Retirada de ${withdraw.item.name}</h3>
      <div class="form-grid" style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
        <label>Quantidade <input id="withdraw-qty-input" type="number" min="1" value="1" max="${withdraw.item.qty}"></label>
        <label>Destino 
          <select id="withdraw-dest-input" style="width:100%; height:38px; background:#222; color:#fff; border-radius:4px; border:1px solid #444;">
            ${state.destinations.map(d => `<option value="${d}">${d}</option>`).join("")}
          </select>
        </label>
        <button id="withdraw-submit-btn" class="primary-action wide">Solicitar Liberação</button>
      </div>
    `;
        $("#withdraw-submit-btn").addEventListener("click", async () => {
            try {
                await apiRequest("/movements/withdraw", {
                    method: "POST",
                    body: JSON.stringify({
                        code: withdraw.item.code,
                        technician: withdraw.technician,
                        destination: $("#withdraw-dest-input").value,
                        quantity: Number($("#withdraw-qty-input").value)
                    })
                });
                alert("Solicitação enviada!");
                setView("dashboard");
                bootstrapApp();
            } catch (e) { alert(e.message); }
        });
    }
}

// Ação de Devolução
$("#return-button")?.addEventListener("click", () => returnItem());
async function returnItem() {
    const codeInput = $("#return-code");
    const qtyInput = $("#return-quantity");
    if (!codeInput || !codeInput.value) return;

    try {
        const payload = { code: normalize(codeInput.value), quantity: parseInt(qtyInput?.value || "1", 10) };
        if (isAdmin()) {
            const tech = prompt("Nome do Técnico devolvendo:");
            if (tech) payload.technician = tech;
        } else {
            payload.technician = currentUser.name;
        }

        await apiRequest("/movements/return", { method: "POST", body: payload });
        $("#return-result").textContent = "Item devolvido com sucesso!";
        codeInput.value = "";
        if (qtyInput) qtyInput.value = "1";
        bootstrapApp();
    } catch (e) { $("#return-result").textContent = e.message; }
}

async function handleReplenish() {
    const code = $("#replenish-code").value;
    const qty = Number($("#replenish-qty").value);
    try {
        await apiRequest("/movements/replenish", {
            method: "POST",
            body: JSON.stringify({ code, quantity: qty })
        });
        $("#replenish-result").textContent = "Estoque atualizado com sucesso!";
        $("#replenish-code").value = "";
        bootstrapApp();
    } catch (e) { $("#replenish-result").textContent = e.message; }
}

async function approveRequest(id, btn) {
    if (btn) btn.disabled = true;
    try {
        await apiRequest(`/requests/${id}/approve`, { method: "POST" });
        bootstrapApp();
    } catch (e) { 
        alert(e.message);
        if (btn) btn.disabled = false;
    }
}

async function cancelRequest(id, btn) {
    if (btn) btn.disabled = true;
    try {
        await apiRequest(`/requests/${id}/cancel`, { method: "DELETE" });
        bootstrapApp();
    } catch (e) {
        alert(e.message);
        if (btn) btn.disabled = false;
    }
}

// Manipulação dos Modais (Dialogs) de Criação do Usuário e Insumos
function openItemDialog(code = null) {
    const dialog = $("#item-dialog");
    const form = $("#item-form");
    if (!dialog || !form) return;

    if (code) {
        const item = state.items.find(i => i.code === code);
        if (!item) return;
        $("#dialog-title").textContent = "Editar Insumo";
        $("#item-original-code").value = item.code;
        $("#item-code").value = item.code;
        $("#item-name").value = item.name;
        $("#item-category").value = item.category;
        $("#item-qty").value = item.qty;
        $("#item-min").value = item.min;
        $("#item-supplier").value = item.supplier || "";
        $("#item-note").value = item.note || "";
    } else {
        $("#dialog-title").textContent = "Novo Insumo";
        form.reset();
        $("#item-original-code").value = "";
    }
    dialog.showModal();
}

// Evento de Login sintonizado com o banco Supabase
async function handleLogin(e) {
    e.preventDefault();
    const name = $("#login-user").value;
    const pin = $("#login-pin").value;
    try {
        const data = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify({ name, pin })
        });
        currentUser = data.user;
        $("#session-label").textContent = `${currentUser.name} (${currentUser.role})`;
        $("#login-screen").style.display = "none";
        
        $$("[data-admin-only]").forEach(el => el.style.display = isAdmin() ? "" : "none");
        setView(isAdmin() ? "dashboard" : "withdraw");
        
        bootstrapApp();
        refreshTimer = setInterval(bootstrapApp, 4000); // Polling em tempo real a cada 4 segundos
    } catch (err) {
        $("#login-error").textContent = err.message;
    }
}

// Configuração de Eventos Globais do seu HTML original
document.addEventListener("DOMContentLoaded", () => {
    $("#login-form")?.addEventListener("submit", handleLogin);
    $("#return-button")?.addEventListener("click", handleReturn);
    $("#return-code")?.addEventListener("keydown", (e) => { if (e.key === "Enter") handleReturn(); });
    $("#replenish-button")?.addEventListener("click", handleReplenish);
    $("#global-search")?.addEventListener("input", renderAll);
    $("#technician-filter")?.addEventListener("change", renderAll);

    // Navegação lateral dinâmica
    $$(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    // Jump-links internos do seu dashboard
    $$("[data-view-jump]").forEach(btn => {
        btn.addEventListener("click", () => setView(btn.dataset.viewJump));
    });

    // Gatilhos dos Modais originais
    $("#new-item-button")?.addEventListener("click", () => openItemDialog());
    $("#close-dialog")?.addEventListener("click", () => $("#item-dialog").close());
    $("#new-user-button")?.addEventListener("click", () => $("#user-dialog").showModal());
    $("#close-user-dialog")?.addEventListener("click", () => $("#user-dialog").close());

    // Gravação de novo insumo via modal dialog
    $("#item-form")?.addEventListener("submit", async (e) => {
        e.preventDefault(); // IMPORTANTE para evitar que a página recarregue
        const origCode = $("#item-original-code").value;
        const body = {
            code: $("#item-code").value,
            name: $("#item-name").value,
            category: $("#item-category").value,
            qty: Number($("#item-qty").value),
            min: Number($("#item-min").value),
            supplier: $("#item-supplier").value,
            note: $("#item-note").value
        };
        try {
            const url = origCode ? `/supplies/${origCode}` : "/supplies";
            await apiRequest(url, { method: origCode ? "PUT" : "POST", body: JSON.stringify(body) });
            $("#item-dialog").close();
            bootstrapApp();
        } catch (err) { alert(err.message); }
    });

    // Gravação de novo usuário via modal dialog
    $("#user-form")?.addEventListener("submit", async (e) => {
        const body = {
            name: $("#user-name").value,
            role: $("#user-role").value,
            pin: $("#user-pin").value
        };
        try {
            await apiRequest("/users", { method: "POST", body: JSON.stringify(body) });
            alert("Usuário adicionado!");
            bootstrapApp();
        } catch (err) { alert(err.message); }
    });

    $("#logout-button")?.addEventListener("click", () => {
        clearInterval(refreshTimer);
        currentUser = null;
        $("#login-form").reset();
        $("#login-error").textContent = "";
        $("#login-screen").style.display = "flex";
    });
});
