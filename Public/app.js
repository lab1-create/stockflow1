const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? '' 
    : 'https://stockflow1-1.onrender.com';

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .catch(err => console.error("SW Registration failed:", err));
    });
}

let state = {
    users: [],
    pendingUsers: [],
    technicians: [],
    destinations: [],
    items: [],
    history: [],
    requests: [],
    usageKpis: [],
    currentSector: 'tecnica'
};

let currentUser = null;
let currentView = "dashboard";
let withdraw = { step: 0, technician: "", isManual: false, destination: "", item: null, qty: 1 };
let refreshTimer = null;
let countItem = null;
let currentHistoryTab = 'withdrawals';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function normalizeSector(s) {
    return String(s || "").trim().toLowerCase() === "faturamento" ? "faturamento" : "tecnica";
}

function setSector(sector) {
    state.currentSector = normalizeSector(sector);
    if (isAdmin()) {
        localStorage.setItem("stockflow_active_sector", state.currentSector);
    }
    updateSectorUI();
    if (currentView === "withdraw") {
        withdraw.step = isAdmin() ? 0 : 2;
        withdraw.technician = isAdmin() ? "" : currentUser.name;
        withdraw.destination = state.currentSector === 'faturamento' ? "Faturamento" : "Laboratório";
        renderWithdraw();
    }
    renderAll();
}

function updateSectorUI() {
    const isFat = state.currentSector === 'faturamento';
    const btnTec = $("#sector-btn-tecnica");
    const btnFat = $("#sector-btn-faturamento");
    if (btnTec) btnTec.classList.toggle("active", !isFat);
    if (btnFat) btnFat.classList.toggle("active", isFat);

    const techShell = $(".app-shell");
    const fatShell = $("#faturamento-shell");

    if (currentUser) {
        if (isFat) {
            if (techShell) techShell.style.display = "none";
            if (fatShell) fatShell.style.display = "flex";
            if ($("#fat-switch-to-tecnica")) {
                $("#fat-switch-to-tecnica").style.display = isAdmin() ? "inline-flex" : "none";
            }
            if ($("#fat-session-label")) {
                $("#fat-session-label").textContent = `${currentUser.name} (${isAdmin() ? 'Admin' : 'Faturamento'})`;
            }
            const respInput = $("#fat-mov-resp");
            if (respInput && !respInput.value) {
                respInput.value = currentUser.name;
            }
        } else {
            if (fatShell) fatShell.style.display = "none";
            if (techShell) techShell.style.display = "flex";
        }
    }

    if ($("#section-eyebrow")) {
        $("#section-eyebrow").textContent = isFat ? "Faturamento" : "Assistencia tecnica";
    }
    if ($("#brand-subtitle")) {
        $("#brand-subtitle").textContent = isFat ? "Insumos - Faturamento" : "Controle de insumos";
    }
}

function getAuthHeaders(extraHeaders = {}) {
    const token = localStorage.getItem("stockflow_token");
    const headers = { ...extraHeaders };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

async function bootstrapApp() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/bootstrap`, { 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (res.status === 401) {
            // Usuario nao autenticado ainda, apenas ignorar silenciosamente
            return;
        }
        const data = await res.json();
        
        const users = data.users.filter(u => u.active);
        const pendingUsrs = data.users.filter(u => !u.active || u.pending_pin_code);
        const destinations = data.destinations;
        const supplies = data.supplies;
        const movements = data.movements;
        const requests = data.requests;

        state.items = (supplies || []).map(s => ({
            ...s,
            sector: normalizeSector(s.sector),
            unit: s.unit || 'un',
            initialQty: Number(s.initial_quantity) || 0,
            entriesTotal: Number(s.entries_total) || 0,
            exitsTotal: Number(s.exits_total) || 0,
            lastMovementAt: s.last_movement_at || null,
            qty: s.current_quantity || 0,
            min: s.minimum_quantity || 0,
            supplier: s.supplier || "",
            note: s.note || ""
        }));

        // Mapeamento e calculo de status "Em uso" por insumo e usuario
        const userSupplyBalance = {};
        (movements || []).slice().reverse().forEach(m => {
            let uName = m.user_name || "Sistema";
            if (m.note && m.note.startsWith("Para:")) uName = `${uName} (${m.note})`;
            else if (m.note && (m.note.startsWith("Retirado por") || m.note.includes(" Retirou "))) uName = m.note;

            const key = `${uName}_${m.supply_id}`;
            if (!userSupplyBalance[key]) userSupplyBalance[key] = 0;
            if (m.movement_type === 'withdrawal') userSupplyBalance[key] += Number(m.quantity) || 0;
            if (m.movement_type === 'return') userSupplyBalance[key] = Math.max(0, userSupplyBalance[key] - (Number(m.quantity) || 0));
        });

        state.history = (movements || []).map(m => {
            let typeDesc = 'Desconhecido';
            if (m.note === "Cadastro inicial") typeDesc = "Cadastro";
            else if (m.movement_type === 'withdrawal') typeDesc = 'Retirada';
            else if (m.movement_type === 'replenishment') typeDesc = 'Reposição';
            else if (m.movement_type === 'return') typeDesc = 'Devolução';
            else if (m.movement_type === 'adjustment') typeDesc = 'Ajuste/Contagem';

            let uName = m.user_name || "Sistema";
            if (m.note && m.note.startsWith("Para:")) uName = `${uName} (${escapeHTML(m.note)})`;
            else if (m.note && (m.note.startsWith("Retirado por") || m.note.includes(" Retirou "))) uName = escapeHTML(m.note);

            const key = `${uName}_${m.supply_id}`;
            const inUse = m.movement_type === 'withdrawal' && (userSupplyBalance[key] > 0);

            return {
                id: m.id,
                user: uName,
                type: typeDesc,
                inUse: inUse,
                itemCode: m.code || "-",
                itemName: m.supply_name || "Desconhecido",
                qty: m.quantity,
                qtyBefore: m.quantity_before,
                qtyAfter: m.quantity_after,
                destination: m.dest_name || "-",
                at: m.created_at,
                note: m.note || "",
                sector: normalizeSector(m.sector)
            };
        });

        state.requests = (requests || []).map(r => {
            let techName = r.user_name || "Desconhecido";
            if (r.note && r.note.startsWith("Para:")) techName = `${techName} (${r.note})`;
            
            let itemName = r.supply_name;
            let isCustom = false;
            if (!itemName && r.note) {
                const match = r.note.match(/\[SOLICITAÇÃO DE INSUMO NÃO CADASTRADO:\s*([^\]]+)\]/);
                if (match) {
                    itemName = match[1];
                    isCustom = true;
                } else {
                    const match2 = r.note.match(/\[SOLICITAÇÃO DE INSUMO:\s*([^\]]+)\]/);
                    if (match2) {
                        itemName = match2[1];
                        isCustom = true;
                    }
                }
            }
            if (!itemName) {
                itemName = "Insumo Desconhecido";
                isCustom = !r.supply_id;
            }

            return {
                id: r.id,
                technician: techName,
                qty: r.quantity || 1,
                itemCode: r.code || "-",
                itemName: itemName,
                isCustom: isCustom,
                status: r.status,
                note: r.note || "",
                sector: normalizeSector(r.sector)
            };
        });
        
        state.technicians = (users || []).map(u => {
            const normSec = normalizeSector(u.sector);
            return { 
                name: u.name, 
                sector: normSec,
                defaultDest: (normSec === 'faturamento') ? "Faturamento" : "Laboratório"
            };
        });
        state.users = users || [];
        state.pendingUsers = pendingUsrs || [];
        
        if (destinations && destinations.length > 0) {
            state.destinations = destinations.map(d => d.name || d);
        }

        renderAll();
    } catch (err) {
        console.error("Erro ao sincronizar com banco:", err);
    }
}

function isAdmin() { return currentUser?.role === "admin"; }
function normalize(value) { return String(value || "").trim().toLowerCase(); }
function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function filteredItems() {
    const query = normalize($("#global-search")?.value || "");
    const sectorItems = state.items.filter(item => (item.sector || 'tecnica') === state.currentSector);
    if (!query) return sectorItems;
    return sectorItems.filter(item => [item.code, item.name, item.category, item.supplier].some(f => normalize(f).includes(query)));
}

function filteredHistory(forTable = false) {
    const query = normalize($("#global-search")?.value || "");
    const technician = isAdmin() ? ($("#technician-filter")?.value || "") : currentUser.name;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return state.history.filter(entry => {
        const matchesSector = (entry.sector || 'tecnica') === state.currentSector;
        const matchesSearch = !query || [entry.user, entry.type, entry.itemName, entry.itemCode].some(f => normalize(f).includes(query));
        const matchesTech = !technician || entry.user.includes(technician);
        const matchesDate = isAdmin() || new Date(entry.at) >= sevenDaysAgo;
        
        let matchesTab = true;
        if (forTable) {
            if (currentHistoryTab === 'withdrawals') {
                matchesTab = entry.type === 'Retirada' || entry.type === 'Devolução';
            } else {
                matchesTab = entry.type !== 'Retirada' && entry.type !== 'Devolução';
            }
        }
        
        return matchesSector && matchesSearch && matchesTech && matchesDate && matchesTab;
    });
}

function setView(view) {
    if (!isAdmin() && ["dashboard", "replenish", "count", "items", "out-of-stock"].includes(view)) {
        view = "withdraw";
    }
    currentView = view;
    $$(".view").forEach(node => node.classList.toggle("active", node.id === `${view}-view`));
    $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));

    const titleMap = { dashboard: "Painel Administrativo", withdraw: "Retirar Insumo", return: "Devolver Insumo", replenish: "Entrada (Reposição)", count: "Contagem / Auditoria", items: "Insumos", history: "Auditoria Completa", "request-item": "Solicitar Insumo", "out-of-stock": "Insumos Faltantes" };
    if ($("#view-title")) $("#view-title").textContent = titleMap[view] || "Dashboard";

    if (view === "withdraw") {
        const defaultDest = state.currentSector === 'faturamento' ? "Faturamento" : "Laboratório";
        withdraw = { step: isAdmin() ? 0 : 2, technician: isAdmin() ? "" : currentUser.name, isManual: false, destination: defaultDest, item: null, qty: 1 };
        renderWithdraw();
    }
    renderAll();
}

function exportCSV(filename, headers, rows) {
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function handleExportCritical() {
    const criticalItems = state.items.filter(i => Number(i.qty) <= 1);
    const headers = ["LISTA DE INSUMOS", "QUANTIDADE"];
    const rows = criticalItems.map(i => {
        // Exportando vazio na quantidade para preenchimento manual, e uma fórmula simples para o Excel (ex: =B2*D2)
        // Mas como a fórmula varia por idioma (C2*D2) e csv escapa coisas, melhor deixar o TOTAL em branco ou sem fórmula complexa.
        return [`"${escapeHTML(i.name)}"`, ""];
    });
    exportCSV(`pedido_insumos_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
}

function handleExportHistory() {
    const headers = ["Data", "Tipo", "Operador", "Codigo", "Insumo", "Qtd", "Antes", "Depois", "Destino", "Obs"];
    const rows = state.history.map(h => [
        `"${formatDate(h.at)}"`,
        h.type,
        `"${h.user}"`,
        h.itemCode,
        `"${h.itemName}"`,
        h.qty,
        h.qtyBefore,
        h.qtyAfter,
        `"${escapeHTML(h.destination)}"`,
        `"${escapeHTML(h.note)}"`
    ]);
    exportCSV(`auditoria_estoque_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
}

function renderAll() {
    renderSearchResults();
    
    const sectorItems = state.items.filter(i => (i.sector || 'tecnica') === state.currentSector);
    const criticalItems = sectorItems.filter(i => Number(i.qty) <= 1);
    const sectorHistory = state.history.filter(h => (h.sector || 'tecnica') === state.currentSector);
    const pendingRequests = state.requests.filter(r => (r.sector || 'tecnica') === state.currentSector && r.status === "pending");
    const outOfStockItems = sectorItems.filter(i => Number(i.qty) === 0);

    if ($("#metric-total-items")) $("#metric-total-items").textContent = sectorItems.length;
    if ($("#metric-critical")) $("#metric-critical").textContent = criticalItems.length;
    if ($("#metric-withdrawals")) $("#metric-withdrawals").textContent = sectorHistory.filter(h => h.type === "Retirada").length;
    if ($("#metric-stock")) $("#metric-stock").textContent = sectorItems.reduce((acc, i) => acc + Number(i.qty), 0);

    const critList = $("#critical-list");
    if (critList) {
        critList.innerHTML = criticalItems.length
            ? criticalItems.map(i => `<div class="compact-row"><span>${escapeHTML(i.name)}</span><strong style="color:#ff2a55;">${i.qty} un</strong></div>`).join("")
            : `<p class="muted">Estoque sob controle.</p>`;
    }

    if ($("#pending-count")) $("#pending-count").textContent = `${pendingRequests.length} pendentes`;

    const reqList = $("#pending-requests");
    if (reqList) {
        reqList.innerHTML = pendingRequests.length
            ? pendingRequests.map(r => {
                if (r.isCustom) {
                    return `
                      <div class="request-card" style="padding:10px; border:1px solid #ff9800; margin-bottom:8px; border-radius:4px; background: rgba(255,152,0,0.05);">
                        <p><strong>${escapeHTML(r.technician)} </strong> solicitou <strong style="color:#ff9800;">${escapeHTML(r.itemName)}</strong> (Não cadastrado)</p>
                        <div style="display:flex; gap:8px;">
                            <button class="primary-action" data-register-name="${escapeHTML(r.itemName)}" style="margin-top:5px; flex:1; background:#ef6c00; border-color:#ef6c00; color:white;">Cadastrar</button>
                            <button class="danger-action" data-reject="${r.id}" style="margin-top:5px; flex:1; border:1px solid #ff4444; background:transparent; color:#ff4444; border-radius:4px; cursor:pointer;">Rejeitar</button>
                        </div>
                      </div>
                    `;
                } else {
                    return `
                      <div class="request-card" style="padding:10px; border:1px solid #444; margin-bottom:8px; border-radius:4px;">
                        <p><strong>${escapeHTML(r.technician)} </strong> solicitou ${escapeHTML(String(r.qty))}x ${escapeHTML(r.itemName)}</p>
                        <div style="display:flex; gap:8px;">
                            <button class="primary-action" data-approve="${r.id}" style="margin-top:5px; flex:1;">Liberar</button>
                            <button class="danger-action" data-reject="${r.id}" style="margin-top:5px; flex:1; border:1px solid #ff4444; background:transparent; color:#ff4444; border-radius:4px; cursor:pointer;">Rejeitar</button>
                        </div>
                      </div>
                    `;
                }
            }).join("")
            : `<p class="muted">Nenhuma solicitação pendente.</p>`;
            
        $$("[data-approve]").forEach(btn => btn.addEventListener("click", () => approveRequest(btn.dataset.approve, btn)));
        $$("[data-reject]").forEach(btn => btn.addEventListener("click", () => cancelRequest(btn.dataset.reject, btn)));
        $$("[data-register-name]").forEach(btn => btn.addEventListener("click", () => openItemDialog(null, btn.dataset.registerName)));
    }

    const oosList = $("#out-of-stock-list");
    if (oosList) {
        oosList.innerHTML = outOfStockItems.length
            ? outOfStockItems.map(i => `
              <div class="request-card" style="padding:10px; border:1px solid #ff4444; margin-bottom:8px; border-radius:4px; background: rgba(255,68,68,0.05);">
                <p>O insumo <strong>${escapeHTML(i.name)}</strong> (${escapeHTML(i.code)}) acabou!</p>
                <div style="display:flex; gap:8px;">
                    <button class="primary-action" data-replenish-code="${escapeHTML(i.code)}" style="margin-top:5px; flex:1; background:#cc1111; border-color:#cc1111; color:white;">Repor Estoque</button>
                </div>
              </div>
            `).join("")
            : `<p class="muted">Todos os insumos possuem estoque cadastrado.</p>`;
            
        $$("[data-replenish-code]").forEach(btn => btn.addEventListener("click", () => {
            setView("replenish");
            const codeInput = $("#replenish-code");
            if (codeInput) {
                codeInput.value = btn.dataset.replenishCode;
                codeInput.focus();
                codeInput.select();
            }
        }));
    }

    const myReqList = $("#my-pending-requests");
    if (myReqList) {
        // Includes manual outputs created by this user
        const myRequests = pendingRequests.filter(r => r.technician.includes(currentUser?.name) || (r.note && r.note.includes(currentUser?.name)));
        myReqList.innerHTML = myRequests.length
            ? myRequests.map(r => `
          <div class="request-card" style="padding:10px; border:1px solid #444; margin-bottom:8px; border-radius:4px; display: flex; justify-content: space-between; align-items: center;">
            <p style="margin: 0;">Aguardando <strong>${escapeHTML(String(r.qty))}x ${escapeHTML(r.itemName)}</strong>...</p>
            <button class="danger-action" data-cancel="${r.id}" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid #ff4444; background: transparent; color: #ff4444; cursor: pointer;">Cancelar</button>
          </div>
        `).join("")
            : `<p class="muted">Você não tem solicitações em andamento.</p>`;
        $$("[data-cancel]").forEach(btn => btn.addEventListener("click", () => cancelRequest(btn.dataset.cancel, btn)));
    }

    const recHist = $("#recent-history");
    if (recHist) {
        const data = filteredHistory().slice(0, 5);
        recHist.innerHTML = data.length
            ? `<div class="table-body">` + data.map(h => `
                <div class="table-row">
                    <span>${escapeHTML(h.itemName)}</span>
                    <span>${escapeHTML(h.user)} ${h.destination && h.destination !== "-" ? `<br><small style="color:#999;">🪑 ${escapeHTML(h.destination)}</small>` : ''}</span>
                    <span>
                        ${escapeHTML(h.type)}
                        ${h.inUse ? `<span style="background: #ff2a55; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-left: 6px; font-weight: bold;">EM USO</span>` : ''}
                    </span>
                    <span>${formatDate(h.at)}</span>
                </div>
            `).join("") + `</div>`
            : `<p class="muted">Nenhum registro.</p>`;
    }
    
    const pendUsersList = $("#pending-users");
    if (pendUsersList) {
        if ($("#pending-users-count")) $("#pending-users-count").textContent = `${state.pendingUsers.length} pendentes`;
        pendUsersList.innerHTML = state.pendingUsers.length
            ? state.pendingUsers.map(u => {
                const isReset = !!u.pending_pin_code;
                const sectorName = u.sector === 'faturamento' ? 'Faturamento' : 'Técnica';
                return `
                  <div class="compact-row" style="padding: 8px; border:1px solid #444; border-radius:4px; margin-bottom: 5px;">
                    <span>
                        <strong>${escapeHTML(u.name)}</strong>
                        <small style="color:#00d2ff; font-size:0.75rem; margin-left:4px;">[${sectorName}]</small>
                        ${isReset ? ' <span style="color:#ffa726; font-size:0.8rem;">(Senha)</span>' : ''}
                    </span>
                    <button class="primary-action" data-approve-user="${u.id}" style="padding:4px 8px; font-size:0.8rem;">Aprovar</button>
                  </div>
                `;
            }).join("")
            : `<p class="muted">Nenhum novo cadastro.</p>`;
    }

    renderItemsGrid();
    renderHistoryTable();
    renderTechnicianFilter();
    renderTechCountPanel();
    renderFaturamentoAll();
}

function renderTechnicianFilter() {
    const select = $("#technician-filter");
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Todos os Usuários</option>';
    const sectorTechs = state.technicians.filter(t => (t.sector || 'tecnica') === state.currentSector);
    sectorTechs.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.name; opt.textContent = t.name;
        if (t.name === currentVal) opt.selected = true;
        select.appendChild(opt);
    });
}

async function approveUser(id) {
    if (!confirm("Aprovar acesso deste usuário?")) return;
    try {
        // I need an endpoint for this, wait, there's no endpoint for approveUser in server.js. Let's add fetch if there's no endpoint... Wait, I need an endpoint first!
        // Actually, the server.js doesn't have an endpoint for approveUser. I'll just change the status locally for now. No wait, that won't save. I'll create an endpoint /api/users/:id/approve in server.js next.
        const res = await fetch(`${API_BASE_URL}/api/users/${id}/approve`, { 
            method: 'POST', 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); }
        bootstrapApp();
    } catch(e) { alert("Erro ao aprovar: " + e.message); }
}

function renderItemsGrid() {
    const grid = $("#items-grid");
    if (!grid) return;
    grid.innerHTML = filteredItems().map(i => `
    <div class="item-card" style="padding:15px; border:1px solid #444; border-radius:4px; background:#1e1e1e;">
      <h3>${escapeHTML(i.name)} </h3>
      <p class="muted">Código: ${escapeHTML(i.code)} | Categoria: ${escapeHTML(i.category)}</p>
      <p>Estoque: <strong style="color: ${Number(i.qty) <= 1 ? '#ff2a55' : 'inherit'}">${Number(i.qty)}</strong></p>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="ghost-action" data-edit-item="${escapeHTML(i.code)}">Editar</button>
      </div>
    </div>
  `).join("");
    $$("[data-edit-item]").forEach(btn => btn.addEventListener("click", () => openItemDialog(btn.dataset.editItem)));
}

function renderHistoryTable() {
    const table = $("#history-table");
    if (!table) return;
    table.innerHTML = filteredHistory(true).map(h => `
    <div class="table-row">
      <span><strong>${escapeHTML(h.itemName)}</strong> (${escapeHTML(h.itemCode)})</span>
      <span>Técnico: ${escapeHTML(h.user)} ${h.destination && h.destination !== "-" ? `<br><small style="color:#aaa;">🪑 Destino: ${escapeHTML(h.destination)}</small>` : ''}</span>
      <span>
        ${escapeHTML(h.type)} (${escapeHTML(String(h.qty))} un)
        ${h.inUse ? `<span style="background: #ff2a55; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-left: 6px; font-weight: bold;">EM USO</span>` : ''}
      </span>
      <span class="muted">${formatDate(h.at)}</span>
    </div>
  `).join("");
}

window.selectItemForWithdraw = (code) => {
    const item = state.items.find(i => i.code === code);
    if (!item) return;
    withdraw.item = item;
    withdraw.step = 3;
    renderWithdraw();
};

function renderWithdraw() {
    const content = $("#withdraw-content");
    if (!content) return;

    if (withdraw.step === 0) {
        const sectorTechs = state.technicians.filter(t => (t.sector || 'tecnica') === state.currentSector);
        const sectorTitle = state.currentSector === 'faturamento' ? "Quem vai retirar no Faturamento?" : "Quem vai retirar?";
        content.innerHTML = `
            <h3>${sectorTitle}</h3>
            <div class="form-grid" style="margin-top:10px;">
                ${sectorTechs.length ? sectorTechs.map(t => `<button class="primary-action" data-select-tech="${escapeHTML(t.name)}">${escapeHTML(t.name)} </button>`).join("") : '<p class="muted">Nenhum colaborador cadastrado neste setor.</p>'}
            </div>
            <div style="margin-top: 20px; text-align: center; border-top: 1px solid #444; padding-top: 15px;">
                <p class="muted" style="margin-bottom: 10px; font-size: 0.9rem;">Retirada para não cadastrados ou visitantes:</p>
                <button class="ghost-action wide" id="btn-manual-out" style="border: 1px dashed #666;">Saída Manual / Sem Login</button>
            </div>
        `;
        $$("[data-select-tech]").forEach(b => b.addEventListener("click", () => { withdraw.technician = b.dataset.selectTech; withdraw.isManual = false; withdraw.step = 2; renderWithdraw(); }));
        $("#btn-manual-out")?.addEventListener("click", () => {
            const name = prompt("Digite o nome de quem está retirando (ou destino da saída manual):");
            if(name && name.trim()) {
                withdraw.technician = name.trim();
                withdraw.isManual = true;
                withdraw.step = 2;
                renderWithdraw();
            }
        });
        return;
    }

    if (withdraw.step === 2) {
        content.innerHTML = `
            <h3>Bipe o Insumo</h3>
            <p class="muted">Técnico / Colaborador: ${escapeHTML(withdraw.technician)}</p>
            <div class="scan-row" style="margin-top:10px;">
                <input id="withdraw-code-input" class="scan-input" placeholder="Código do insumo">
                <button id="withdraw-find-btn" class="primary-action">Identificar</button>
            </div>
            <div style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px; text-align: center;">
                <p class="muted" style="margin-bottom: 10px; font-size: 0.9rem;">Não sabe o código do produto?</p>
                <button id="btn-request-name" class="ghost-action wide" style="border: 1px dashed #666; color: white;">SOLICITAR INSUMO</button>
            </div>
        `;
        const findItemAction = () => {
            const code = normalize($("#withdraw-code-input").value);
            const item = state.items.find(i => (i.sector || 'tecnica') === state.currentSector && normalize(i.code) === code);
            if (!item) return alert(`Insumo não encontrado no setor de ${state.currentSector === 'faturamento' ? 'Faturamento' : 'Assistência Técnica'}!`);
            withdraw.item = item; withdraw.step = 3; renderWithdraw();
        };
        $("#withdraw-find-btn").addEventListener("click", findItemAction);
        $("#withdraw-code-input").addEventListener("keydown", (e) => { if (e.key === "Enter") findItemAction(); });
        $("#btn-request-name").addEventListener("click", () => {
            withdraw.step = "request_by_name";
            renderWithdraw();
        });
        return;
    }

    if (withdraw.step === "request_by_name") {
        content.innerHTML = `
            <h3>Solicitar Insumo (Cadastrado ou Novo)</h3>
            <p class="muted">Técnico / Colaborador: ${escapeHTML(withdraw.technician)}</p>
            <div style="margin-top:10px;">
                <label style="display: block; text-align: left;">Digite o nome do produto ou equipamento:
                    <input id="request-name-input" class="scan-input" placeholder="Ex: Bobina térmica, Fita gomada, Embalagem..." autocomplete="off" style="width: 100%; margin-top: 5px;">
                </label>
            </div>
            <div id="request-name-results" style="margin-top: 10px; max-height: 180px; overflow-y: auto; text-align: left;"></div>
            <div style="margin-top: 15px; border-top: 1px solid #444; padding-top: 15px;">
                <button id="btn-submit-custom-request" class="primary-action wide">Solicitar Item Não Cadastrado</button>
                <button class="ghost-action wide" style="margin-top: 10px;" id="btn-request-back">Voltar</button>
            </div>
        `;

        const input = $("#request-name-input");
        const results = $("#request-name-results");
        
        input.focus();
        input.addEventListener("input", () => {
            const query = normalize(input.value);
            if (!query) {
                results.innerHTML = "";
                return;
            }
            const matchingItems = state.items.filter(i => (i.sector || 'tecnica') === state.currentSector && (normalize(i.name).includes(query) || normalize(i.code).includes(query)));
            if (matchingItems.length === 0) {
                results.innerHTML = "<p class='muted' style='padding: 10px;'>Item não encontrado no catálogo deste setor. Você pode clicar no botão abaixo para solicitar como item não cadastrado!</p>";
            } else {
                results.innerHTML = matchingItems.map(i => `
                    <div style="padding: 10px; border-bottom: 1px solid #444; cursor: pointer; transition: background 0.2s;"
                         data-select-withdraw="${escapeHTML(i.code)}"
                         >
                         <strong style="color: white;">${escapeHTML(i.name)}</strong> <span class="muted" style="font-size: 0.8rem;">(${escapeHTML(i.code)})</span>
                         <br><small style="color: ${Number(i.qty) > 0 ? '#2e7d32' : '#e53935'}">Estoque: ${i.qty}</small>
                    </div>
                `).join("");
                $$("[data-select-withdraw]").forEach(el => {
                    el.addEventListener("click", () => {
                        window.selectItemForWithdraw(el.dataset.selectWithdraw);
                    });
                });
            }
        });

        $("#btn-request-back")?.addEventListener("click", () => { withdraw.step = 2; renderWithdraw(); });

        $("#btn-submit-custom-request")?.addEventListener("click", async () => {
            const nameVal = input.value.trim();
            if (!nameVal) return alert("Digite o nome do produto para solicitar.");
            const qtyStr = prompt("Quantidade necessária:", "1");
            const qty = Number(qtyStr) || 1;
            const note = prompt("Observação para o administrador (Opcional):") || "";
            try {
                // Tentar enviar via endpoint de retiradas com observação especial
                const res = await fetch(`${API_BASE_URL}/api/movements/withdraw`, {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        code: nameVal, // Tenta usar o nome como codigo/referencia ou envia insumo basico
                        quantity: qty,
                        technician: withdraw.technician,
                        sector: state.currentSector,
                        note: `[SOLICITAÇÃO DE INSUMO: ${nameVal}] (Por ${withdraw.technician}) ${note}`
                    })
                });

                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.error || "Erro ao registrar solicitação com o Administrador.");
                }

                alert(`Solicitação do item '${nameVal}' enviada com sucesso ao administrador!`);
                setView("dashboard");
                bootstrapApp();
            } catch (e) { alert(e.message); }
        });
        return;
    }

    if (withdraw.step === 3) {
        const techInfo = state.technicians.find(t => t.name === withdraw.technician);
        const defaultDest = state.currentSector === 'faturamento' ? "Faturamento" : "Laboratório";
        const destName = withdraw.isManual ? defaultDest : (techInfo?.defaultDest || defaultDest);

        content.innerHTML = `
            <h3>Confirmar Retirada de ${escapeHTML(withdraw.item.name)}</h3>
            <div class="form-grid" style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
                <label>Quantidade <input id="withdraw-qty-input" type="number" min="1" value="1" max="${withdraw.item.qty}"></label>
                ${withdraw.isManual ? `
                    <label>Para quem / Destino da Saída Manual:
                        <input id="withdraw-manual-dest" placeholder="Ex: Massimo, Sala 2..." value="${escapeHTML(withdraw.manualDest || '')}" style="width:100%; margin-top:4px;">
                    </label>
                ` : `
                    <div style="padding:10px; border:1px solid #444; border-radius:4px; background:#222;">
                        <p style="margin:0; font-size:0.9rem;" class="muted">Destino Fixo</p>
                        <p style="margin:0; font-weight:bold;">🪑 ${escapeHTML(destName)}</p>
                    </div>
                `}
                <button id="withdraw-submit-btn" class="primary-action wide">Solicitar Liberação</button>
            </div>
        `;
        $("#withdraw-submit-btn").addEventListener("click", async () => {
            let note = "";
            if (withdraw.isManual) {
                const customDest = $("#withdraw-manual-dest")?.value.trim();
                note = `${withdraw.technician} Retirou ${withdraw.item.name}${customDest ? ' para ' + customDest : ''}`;
            } else {
                note = prompt("Motivo / OS (Opcional):") || "";
            }
            try {
                const res = await fetch(`${API_BASE_URL}/api/movements/withdraw`, {
                    method: 'POST', 
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ 
                        code: withdraw.item.code, 
                        technician: withdraw.technician, 
                        destination: destName, 
                        quantity: Number($("#withdraw-qty-input").value) || 1,
                        note: note,
                        sector: state.currentSector
                    })
                });
                if(!res.ok) { const d = await res.json(); throw new Error(d.error); }
                alert("Solicitação de retirada enviada!"); setView("dashboard"); bootstrapApp();
            } catch (e) { alert(e.message); }
        });
    }
}

async function returnItem() {
    const codeInput = $("#return-code");
    const qtyInput = $("#return-qty");
    const techInput = $("#return-tech");
    
    if (!codeInput || !codeInput.value) return alert("Bipe o código do insumo.");
    
    const code = codeInput.value;
    const quantity = qtyInput ? (Number(qtyInput.value) || 1) : 1;
    const techName = techInput ? techInput.value : currentUser.name;

    try {
        const res = await fetch(`${API_BASE_URL}/api/movements/return`, {
            method: 'POST', 
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ code, quantity, technician: techName })
        });
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); }
        $("#return-result").textContent = "Item devolvido com sucesso!"; codeInput.value = ""; if (qtyInput) qtyInput.value = "1"; bootstrapApp();
    } catch (e) { $("#return-result").textContent = e.message; }
}

async function handleReplenish() {
    const code = $("#replenish-code").value;
    const qty = Number($("#replenish-qty").value);
    try {
        const item = state.items.find(i => (i.sector || 'tecnica') === state.currentSector && normalize(i.code) === normalize(code));
        if (!item) throw new Error("Insumo não encontrado neste setor.");

        const res = await fetch(`${API_BASE_URL}/api/movements/replenish`, {
            method: 'POST', 
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ code: item.code, quantity: qty })
        });
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); }

        $("#replenish-result").textContent = "Estoque atualizado com sucesso!"; $("#replenish-code").value = ""; bootstrapApp();
    } catch (e) { $("#replenish-result").textContent = e.message; }
}

// LOGICA DE CONTAGEM / BALANÇO (ASSISTÊNCIA TÉCNICA)
function showSelectedCountItem(item) {
    if (!item) {
        $("#count-result").textContent = "Referência não encontrada neste setor.";
        $("#count-details").style.display = "none";
        return;
    }
    countItem = item;
    if ($("#count-select-item")) $("#count-select-item").value = item.code;
    if ($("#count-code")) $("#count-code").value = item.code;
    if ($("#count-item-code-badge")) $("#count-item-code-badge").textContent = item.code;
    $("#count-result").textContent = `Insumo identificado: ${item.name} (${item.code}). Informe a contagem física e confirme.`;
    $("#count-item-name").textContent = item.name;
    $("#count-sys-qty").textContent = `${item.qty} un`;
    $("#count-phys-qty").value = item.qty;
    $("#count-details").style.display = "flex";
    $("#count-phys-qty")?.focus();
    $("#count-phys-qty")?.select();
}

function findCountItem() {
    const rawQuery = ($("#count-code")?.value || $("#count-select-item")?.value || "").trim();
    if (!rawQuery) {
        $("#count-result").textContent = "Digite o código/nome ou escolha um insumo na lista.";
        $("#count-details").style.display = "none";
        return;
    }
    const q = normalize(rawQuery);
    const sectorItems = state.items.filter(i => (i.sector || 'tecnica') === state.currentSector);
    const exactMatch = sectorItems.find(i => normalize(i.code) === q || normalize(i.name) === q);
    const partialMatch = sectorItems.find(i => normalize(i.code).includes(q) || normalize(i.name).includes(q));
    showSelectedCountItem(exactMatch || partialMatch || null);
}

async function submitCount() {
    if (!countItem) return alert("Selecione ou identifique um insumo primeiro.");
    const physInput = $("#count-phys-qty");
    const physQty = Number(physInput ? physInput.value : NaN);
    if (isNaN(physQty) || physQty < 0) return alert("Informe uma quantidade física válida (0 ou maior).");

    const btn = $("#count-submit-btn");
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE_URL}/api/movements/adjust`, {
            method: 'POST', 
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ code: countItem.code, physicalQty: physQty })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao registrar contagem.");
        
        const adjustedName = countItem.name;
        countItem = null;
        if ($("#count-code")) $("#count-code").value = "";
        if ($("#count-select-item")) $("#count-select-item").value = "";
        if ($("#count-details")) $("#count-details").style.display = "none";
        if ($("#count-phys-qty")) $("#count-phys-qty").value = "";
        if ($("#count-result")) {
            $("#count-result").innerHTML = `<span style="color:#4ade80; font-weight:600;">✅ Saldo de "${escapeHTML(adjustedName)}" ajustado para ${physQty} un com sucesso!</span>`;
        }
        await bootstrapApp();
    } catch (e) {
        alert(e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function renderTechCountPanel() {
    const select = $("#count-select-item");
    const sectorItems = state.items.filter(i => (i.sector || 'tecnica') === 'tecnica');
    if (select) {
        const cur = select.value;
        select.innerHTML = `<option value="">-- Escolha um insumo cadastrado (${sectorItems.length}) --</option>` +
            sectorItems.map(i => `<option value="${escapeHTML(i.code)}">[${escapeHTML(i.code)}] ${escapeHTML(i.name)} (Saldo: ${i.qty} un)</option>`).join("");
        if (cur && sectorItems.some(i => i.code === cur)) select.value = cur;
    }

    const listEl = $("#tech-count-list");
    if (!listEl) return;
    const filterQ = normalize($("#tech-count-search")?.value || "");
    const filtered = sectorItems.filter(i => !filterQ || [i.code, i.name, i.category].some(f => normalize(f).includes(filterQ)));

    if (filtered.length === 0) {
        listEl.innerHTML = `<p class="muted" style="padding:1rem; text-align:center;">Nenhum insumo encontrado.</p>`;
        return;
    }

    listEl.innerHTML = filtered.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 14px; background:rgba(12,5,8,0.65); border:1px solid rgba(220,38,38,0.2); border-radius:10px; flex-wrap:wrap;">
          <div style="flex:1; min-width:160px;">
            <strong style="color:#fff; font-size:0.95rem;">${escapeHTML(item.name)}</strong>
            <div style="font-size:0.78rem; color:#b89fa5;">Código: <span style="color:#f87171; font-family:monospace;">${escapeHTML(item.code)}</span> · Sistema: <strong>${Number(item.qty) || 0} un</strong></div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="number" min="0" data-tech-count-qty="${escapeHTML(item.code)}" value="${Number(item.qty) || 0}" style="width:84px !important; margin:0 !important; padding:6px 8px !important; text-align:center; font-weight:700;">
            <button type="button" class="primary-action" data-tech-count-save="${escapeHTML(item.code)}" style="padding:7px 12px; font-size:0.8rem;">Ajustar</button>
          </div>
        </div>
    `).join("");
}

async function approveRequest(id, btn) {
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE_URL}/api/requests/${id}/approve`, { 
            method: 'POST', 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); }
        bootstrapApp();
    } catch (e) { alert(e.message); if (btn) btn.disabled = false; }
}

async function cancelRequest(id, btn) {
    if (btn) btn.disabled = true;
    try { 
        const res = await fetch(`${API_BASE_URL}/api/requests/${id}/cancel`, { 
            method: 'DELETE', 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); } bootstrapApp(); } 
    catch (e) { alert(e.message); if (btn) btn.disabled = false; }
}

function openItemDialog(code = null, defaultName = null) {
    const dialog = $("#item-dialog"); const form = $("#item-form");
    if (!dialog || !form) return;
    if (code) {
        const item = state.items.find(i => i.code === code);
        if (!item) return;
        $("#dialog-title").textContent = "Editar Referência"; 
        $("#item-original-code").value = item.code; 
        $("#item-code").value = item.code; 
        $("#item-name").value = item.name; 
        $("#item-category").value = item.category; 
        if ($("#item-sector")) $("#item-sector").value = item.sector || 'tecnica';
        $("#item-min").value = item.min; 
        $("#item-supplier").value = item.supplier || ""; 
        $("#item-note").value = item.note || "";
    } else {
        $("#dialog-title").textContent = "Nova Referência"; 
        form.reset(); 
        $("#item-original-code").value = "";
        if ($("#item-sector")) $("#item-sector").value = state.currentSector || 'tecnica';
        if (defaultName) {
            $("#item-name").value = defaultName;
        }
    }
    dialog.showModal();
}

async function handleLogin(e) {
    e.preventDefault();
    const name = $("#login-user").value.trim();
    const pin = $("#login-pin").value;
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, pin })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        currentUser = data.user;
        if (data.token) localStorage.setItem("stockflow_token", data.token);
        $("#session-label").textContent = `${currentUser.name} (${currentUser.role})`;
        $("#login-screen").style.display = "none";
        $(".app-shell").style.display = "flex";
        $$("[data-admin-only]").forEach(el => el.style.display = isAdmin() ? "" : "none");

        if (isAdmin()) {
            if ($("#sector-switcher")) $("#sector-switcher").style.display = "inline-flex";
            const savedSector = localStorage.getItem("stockflow_active_sector");
            state.currentSector = savedSector ? normalizeSector(savedSector) : 'tecnica';
        } else {
            if ($("#sector-switcher")) $("#sector-switcher").style.display = "none";
            state.currentSector = normalizeSector(currentUser.sector);
        }
        updateSectorUI();

        setView(isAdmin() ? "dashboard" : "withdraw");
        
        bootstrapApp();
        refreshTimer = setInterval(bootstrapApp, 10000); 
    } catch (err) { $("#login-error").textContent = err.message; }
}

document.addEventListener("DOMContentLoaded", () => {
    $("#login-form")?.addEventListener("submit", handleLogin);
    $("#sector-btn-tecnica")?.addEventListener("click", () => setSector("tecnica"));
    $("#sector-btn-faturamento")?.addEventListener("click", () => setSector("faturamento"));
    $("#return-button")?.addEventListener("click", returnItem);
    $("#return-code")?.addEventListener("keydown", (e) => { if (e.key === "Enter") returnItem(); });
    
    // Contagem events
    $("#count-find-btn")?.addEventListener("click", findCountItem);
    $("#count-code")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); findCountItem(); } });
    $("#count-phys-qty")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitCount(); } });
    $("#count-select-item")?.addEventListener("change", (e) => {
        const code = e.target.value;
        if (!code) return;
        const item = state.items.find(i => (i.sector || 'tecnica') === state.currentSector && i.code === code);
        if (item) showSelectedCountItem(item);
    });
    $("#tech-count-search")?.addEventListener("input", renderTechCountPanel);
    $("#count-submit-btn")?.addEventListener("click", submitCount);

    $("#replenish-button")?.addEventListener("click", handleReplenish);
    $("#replenish-code")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const code = $("#replenish-code").value;
            const item = state.items.find(i => (i.sector || 'tecnica') === state.currentSector && normalize(i.code) === normalize(code));
            if (item) {
                const qtyInput = $("#replenish-qty");
                let current = Number(qtyInput.value) || 0;
                qtyInput.value = current + 1;
                $("#replenish-result").textContent = `+1 ${escapeHTML(item.name)} contado! (A repor: ${qtyInput.value})`;
            } else {
                $("#replenish-result").textContent = "Referência não encontrada!";
            }
            $("#replenish-code").select();
        }
    });

    $("#export-critical-btn")?.addEventListener("click", handleExportCritical);
    $("#export-history-btn")?.addEventListener("click", handleExportHistory);

    $("#global-search")?.addEventListener("input", renderAll);
    $("#technician-filter")?.addEventListener("change", renderAll);
    $$(".nav-item").forEach(btn => { btn.addEventListener("click", () => setView(btn.dataset.view)); });
    $$("[data-view-jump]").forEach(btn => { btn.addEventListener("click", () => setView(btn.dataset.viewJump)); });
    
    $$("[data-history-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            $$("[data-history-tab]").forEach(b => {
                b.classList.remove("active");
                b.style.color = "#aaa";
                b.style.borderBottom = "2px solid transparent";
            });
            btn.classList.add("active");
            btn.style.color = "#fff";
            btn.style.borderBottom = "2px solid #ff2a55";
            currentHistoryTab = btn.dataset.historyTab;
            renderHistoryTable();
        });
    });

    $("#new-item-button")?.addEventListener("click", () => openItemDialog());
    $("#close-dialog")?.addEventListener("click", () => $("#item-dialog").close());
    
    $("#custom-request-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const itemName = $("#custom-req-name").value.trim();
        const quantity = Number($("#custom-req-qty").value) || 1;
        const note = $("#custom-req-note").value.trim();
        try {
            const res = await fetch(`${API_BASE_URL}/api/custom-requests`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ itemName, quantity, note, sector: state.currentSector })
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            alert(`Solicitação do item '${itemName}' enviada com sucesso!`);
            $("#custom-request-form").reset();
            setView("withdraw");
            bootstrapApp();
        } catch (err) { alert(err.message); }
    });
    
    $("#new-user-button")?.addEventListener("click", () => $("#user-dialog").showModal());
    $("#close-user-dialog")?.addEventListener("click", () => $("#user-dialog").close());

    $("#open-register-btn")?.addEventListener("click", () => $("#register-dialog").showModal());
    $("#close-register-dialog")?.addEventListener("click", () => $("#register-dialog").close());

    $("#item-form")?.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        const origCode = $("#item-original-code").value;
        const body = { 
            code: $("#item-code").value, 
            name: $("#item-name").value, 
            category: $("#item-category").value, 
            sector: $("#item-sector")?.value || state.currentSector,
            min: Number($("#item-min").value) || 0,
            qty: 0, 
            supplier: $("#item-supplier").value, 
            note: $("#item-note").value,
            link: $("#item-link")?.value || "",
            unit_price: Number($("#item-price")?.value) || 0,
            is_shared: $("#item-shared")?.checked || false
        };
        try {
            if (origCode) {
                const existingItem = state.items.find(i => i.code === origCode);
                body.qty = existingItem ? existingItem.qty : 0;
                const res = await fetch(`${API_BASE_URL}/api/supplies/${origCode}`, {
                    method: 'PUT', 
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(body)
                });
                if(!res.ok) { const d = await res.json(); throw new Error(d.error); }
            } else {
                const res = await fetch(`${API_BASE_URL}/api/supplies`, {
                    method: 'POST', 
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(body)
                });
                if(!res.ok) { const d = await res.json(); throw new Error(d.error); }
            }
            $("#item-dialog").close(); bootstrapApp();
        } catch (err) { alert(err.message); }
    });

    $("#user-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = { 
            name: $("#user-name").value, 
            role: $("#user-role").value, 
            sector: $("#user-sector")?.value || 'tecnica',
            pin: $("#user-pin").value,
            pin_code: $("#user-pin").value, 
            active: true 
        };
        try { 
            const res = await fetch(`${API_BASE_URL}/api/users`, {
                method: 'POST', 
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(body)
            });
            if(!res.ok) { const d = await res.json(); throw new Error(d.error); } 
            alert("Usuário adicionado!"); 
            bootstrapApp(); 
            $("#user-dialog").close(); 
        } catch (err) { alert(err.message); }
    });

    $("#register-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = { 
            name: $("#reg-name").value, 
            pin: $("#reg-pin").value,
            sector: $("#reg-sector")?.value || 'tecnica'
        };
        try { 
            const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error); 
            alert("Sua solicitação foi enviada! O administrador irá aprovar em breve."); 
            $("#register-dialog").close();
            $("#register-form").reset();
        } catch (err) { alert(err.message); }
    });

    $("#open-reset-btn")?.addEventListener("click", () => $("#reset-dialog").showModal());
    $("#close-reset-dialog")?.addEventListener("click", () => $("#reset-dialog").close());

    $("#reset-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = { 
            name: $("#reset-name").value, 
            pin: $("#reset-pin").value 
        };
        try { 
            const res = await fetch(`${API_BASE_URL}/api/auth/reset-password-request`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error); 
            alert("Solicitação de redefinição de senha enviada! O administrador irá aprovar em breve."); 
            $("#reset-dialog").close();
            $("#reset-form").reset();
        } catch (err) { alert(err.message); }
    });

    $("#logout-button")?.addEventListener("click", () => {
        clearInterval(refreshTimer); currentUser = null; $("#login-form").reset(); $("#login-error").textContent = "";
        $(".app-shell").style.display = "none";
        if ($("#faturamento-shell")) $("#faturamento-shell").style.display = "none";
        $("#login-screen").style.display = "flex";
    });

    initFaturamentoEvents();

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search")) { const resultsDiv = $("#search-results"); if (resultsDiv) resultsDiv.style.display = "none"; }
        
        const approveUserBtn = e.target.closest("[data-approve-user]");
        if (approveUserBtn) approveUser(approveUserBtn.dataset.approveUser);

        const requestBackBtn = e.target.closest("#btn-request-back");
        if (requestBackBtn) { withdraw.step = 2; renderWithdraw(); }

        const selectWithdrawBtn = e.target.closest("[data-select-withdraw]");
        if (selectWithdrawBtn) selectItemForWithdraw(selectWithdrawBtn.dataset.selectWithdraw);

        const copyCodeBtn = e.target.closest("[data-copy-code]");
        if (copyCodeBtn) copySearchCode(copyCodeBtn.dataset.copyCode);

        const techCountSaveBtn = e.target.closest("[data-tech-count-save]");
        if (techCountSaveBtn) {
            const code = techCountSaveBtn.dataset.techCountSave;
            const qtyInput = document.querySelector(`[data-tech-count-qty="${code}"]`);
            if (!qtyInput) return;
            const physicalQty = Number(qtyInput.value);
            if (isNaN(physicalQty) || physicalQty < 0) return alert("Quantidade inválida.");
            techCountSaveBtn.disabled = true;
            fetch(`${API_BASE_URL}/api/movements/adjust`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ code, physicalQty })
            })
            .then(async res => {
                const d = await res.json();
                if (!res.ok) throw new Error(d.error || "Erro ao ajustar saldo.");
                if ($("#count-result")) {
                    $("#count-result").innerHTML = `<span style="color:#4ade80; font-weight:600;">✅ Saldo do código ${escapeHTML(code)} ajustado para ${physicalQty} un!</span>`;
                }
                await bootstrapApp();
            })
            .catch(err => alert(err.message))
            .finally(() => { techCountSaveBtn.disabled = false; });
        }
    });
});

function renderSearchResults() {
    const input = $("#global-search"); const resultsDiv = $("#search-results");
    if (!input || !resultsDiv) return;
    const query = normalize(input.value);
    if (!query) { resultsDiv.style.display = "none"; return; }
    const matchingItems = state.items.filter(i => (i.sector || 'tecnica') === state.currentSector && (normalize(i.name).includes(query) || normalize(i.code).includes(query)));
    if (matchingItems.length === 0) {
        resultsDiv.innerHTML = "<div style='padding: 0.5rem 1rem; color: #666;'>Nenhum insumo encontrado.</div>";
    } else {
        resultsDiv.innerHTML = matchingItems.map(i => `
            <div style="padding: 0.5rem 1rem; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background 0.2s;" data-copy-code=\"${escapeHTML(i.code)}\"  title="Clique para copiar o código">
                <div style="display: flex; justify-content: space-between; align-items: center;"><strong style="color: #333;">${escapeHTML(i.name)}</strong><span style="font-family: monospace; background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; color: #555;">${escapeHTML(i.code)}</span></div>
                <div style="margin-top: 4px; font-size: 0.85em; color: #666; display: flex; gap: 10px;"><span>Estoque: <strong style="color: ${Number(i.qty) <= 1 ? '#e53935' : '#2e7d32'};">${i.qty}</strong></span></div>
            </div>
        `).join("");
    }
    resultsDiv.style.display = "block";
}

function copySearchCode(code) {
    navigator.clipboard.writeText(code).then(() => { const resultsDiv = $("#search-results"); if (resultsDiv) resultsDiv.style.display = "none"; alert("Código " + code + " copiado!"); }).catch(err => alert("Erro: " + err));
}

/* =========================================================================
   LÓGICA EXCLUSIVA DO SETOR DE FATURAMENTO (PLANILHA DE CONTROLE)
========================================================================= */
let currentFatView = "estoque";

function setFatView(viewName) {
    currentFatView = viewName;
    $$("[data-fat-view]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.fatView === viewName);
    });
    $$(".fat-view").forEach(sec => {
        sec.classList.toggle("active", sec.id === `fat-view-${viewName}`);
    });
    if (viewName === "referencias" && !$("#fat-ref-orig-code")?.value) {
        suggestNextFatId();
    }
    renderFaturamentoAll();
}

function getFatItems() {
    return state.items
        .filter(i => i.sector === 'faturamento')
        .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'pt-BR', { numeric: true }));
}

function getFatStatus(item) {
    const qty = Number(item.qty) || 0;
    const min = Number(item.min) || 0;
    if (qty <= min) {
        return { key: 'REPOR', label: '🔴 REPOR', cls: 'fat-status-repor' };
    }
    if (qty <= min * 1.5) {
        return { key: 'ATENÇÃO', label: '🟡 ATENÇÃO', cls: 'fat-status-atencao' };
    }
    return { key: 'OK', label: '🟢 OK', cls: 'fat-status-ok' };
}

function getFatCatClass(cat) {
    const c = normalize(cat);
    if (c.includes("carregador")) return "fat-cat-carregadores";
    if (c.includes("documento")) return "fat-cat-documentos";
    if (c.includes("embalagem")) return "fat-cat-embalagem";
    if (c.includes("ferramenta")) return "fat-cat-ferramentas";
    if (c.includes("impress")) return "fat-cat-impressao";
    return "fat-cat-outros";
}

function suggestNextFatId() {
    const codeInput = $("#fat-ref-code");
    if (!codeInput) return;
    const fatItems = getFatItems();
    let maxNum = 0;
    fatItems.forEach(item => {
        const m = String(item.code || "").match(/FAT-(\d+)/i);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
        }
    });
    const nextNum = String(maxNum + 1).padStart(3, "0");
    codeInput.value = `FAT-${nextNum}`;
}

function renderFaturamentoAll() {
    if (!$("#faturamento-shell")) return;
    renderFatSheet();
    renderFatMovementsTab();
    renderFatCountTab();
    renderFatReferencesTab();
    renderFatAuditTab();
}

function renderFatSheet() {
    const allFat = getFatItems();
    let countRepor = 0;
    let countAtencao = 0;
    let countOk = 0;

    allFat.forEach(item => {
        const st = getFatStatus(item);
        if (st.key === 'REPOR') countRepor++;
        else if (st.key === 'ATENÇÃO') countAtencao++;
        else countOk++;
    });

    if ($("#fat-kpi-total")) $("#fat-kpi-total").textContent = allFat.length;
    if ($("#fat-kpi-repor")) $("#fat-kpi-repor").textContent = countRepor;
    if ($("#fat-kpi-atencao")) $("#fat-kpi-atencao").textContent = countAtencao;
    if ($("#fat-kpi-ok")) $("#fat-kpi-ok").textContent = countOk;

    const searchQ = normalize($("#fat-search-input")?.value || "");
    const catFilter = $("#fat-category-filter")?.value || "";
    const statusFilter = $("#fat-status-filter")?.value || "";

    const filtered = allFat.filter(item => {
        const st = getFatStatus(item);
        const matchSearch = !searchQ || [item.code, item.name, item.category, item.unit].some(f => normalize(f).includes(searchQ));
        const matchCat = !catFilter || normalize(item.category) === normalize(catFilter);
        const matchSt = !statusFilter || st.key === statusFilter;
        return matchSearch && matchCat && matchSt;
    });

    const tbody = $("#fat-sheet-tbody");
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 2rem; color:#64748b;">Nenhum insumo encontrado para os filtros selecionados.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const st = getFatStatus(item);
        const catCls = getFatCatClass(item.category);
        const lastMov = item.lastMovementAt ? formatDate(item.lastMovementAt) : "Sem mov.";
        return `
            <tr>
              <td><span class="fat-code-badge">${escapeHTML(item.code)}</span></td>
              <td><strong>${escapeHTML(item.name)}</strong></td>
              <td><span class="fat-cat-badge ${catCls}">${escapeHTML(item.category || 'Outros')}</span></td>
              <td style="color:#475569; font-weight:600;">${escapeHTML(item.unit || 'un')}</td>
              <td class="fat-cell-yellow">
                <input type="number" min="0" class="fat-yellow-input" data-fat-cell-init="${escapeHTML(item.code)}" value="${Number(item.initialQty) || 0}" title="Clique ou altere para ajustar o Estoque Inicial">
              </td>
              <td style="color:#059669; font-weight:700;">+${Number(item.entriesTotal) || 0}</td>
              <td style="color:#dc2626; font-weight:700;">-${Number(item.exitsTotal) || 0}</td>
              <td style="font-size:1rem; font-weight:800; color:#0f172a;">${Number(item.qty) || 0} <small style="font-weight:500; color:#64748b;">${escapeHTML(item.unit || 'un')}</small></td>
              <td class="fat-cell-yellow">
                <input type="number" min="0" class="fat-yellow-input" data-fat-cell-min="${escapeHTML(item.code)}" value="${Number(item.min) || 0}" title="Clique ou altere para ajustar o Estoque Mínimo">
              </td>
              <td><span class="fat-status-pill ${st.cls}">${st.label}</span></td>
              <td style="color:#64748b; font-size:0.82rem; white-space:nowrap;">${lastMov}</td>
              <td>
                <div class="fat-row-actions">
                  <button type="button" class="fat-mini-btn in" data-fat-quick-in="${escapeHTML(item.code)}" title="Lançar Entrada">+ Entrada</button>
                  <button type="button" class="fat-mini-btn out" data-fat-quick-out="${escapeHTML(item.code)}" title="Lançar Saída">- Saída</button>
                  <button type="button" class="fat-mini-btn" data-fat-quick-edit="${escapeHTML(item.code)}" title="Editar Referência">Editar</button>
                </div>
              </td>
            </tr>
        `;
    }).join("");
}

function renderFatMovementsTab() {
    const select = $("#fat-mov-item");
    if (select) {
        const currentVal = select.value;
        const allFat = getFatItems();
        select.innerHTML = `<option value="">-- Selecione o insumo da lista --</option>` +
            allFat.map(i => `<option value="${escapeHTML(i.code)}">[${escapeHTML(i.code)}] ${escapeHTML(i.name)} (Saldo: ${i.qty} ${escapeHTML(i.unit || 'un')})</option>`).join("");
        if (currentVal && allFat.some(i => i.code === currentVal)) {
            select.value = currentVal;
        }
    }

    const recentTbody = $("#fat-mov-recent-tbody");
    if (!recentTbody) return;

    const fatMovs = state.history.filter(h => h.sector === 'faturamento').slice(0, 25);
    if (fatMovs.length === 0) {
        recentTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#64748b;">Nenhuma movimentação lançada ainda.</td></tr>`;
        return;
    }

    recentTbody.innerHTML = fatMovs.map(h => {
        const isEntry = h.type === 'Reposição' || h.type === 'Devolução' || h.type === 'Cadastro';
        const isExit = h.type === 'Retirada';
        const badgeStyle = isEntry
            ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;'
            : (isExit ? 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;' : 'background:#fef3c7; color:#b45309; border:1px solid #fcd34d;');
        const label = isEntry ? '📥 Entrada' : (isExit ? '📤 Saída' : '📋 Ajuste');
        return `
            <tr>
              <td style="white-space:nowrap; font-size:0.82rem; color:#475569;">${formatDate(h.at)}</td>
              <td><span class="fat-code-badge">${escapeHTML(h.itemCode)}</span></td>
              <td><strong>${escapeHTML(h.itemName)}</strong></td>
              <td><span class="fat-status-pill" style="${badgeStyle}">${label}</span></td>
              <td style="font-weight:700;">${isEntry ? '+' : (isExit ? '-' : '')}${escapeHTML(String(h.qty))}</td>
              <td style="color:#64748b; font-size:0.82rem;">${h.qtyBefore ?? '-'} → <strong>${h.qtyAfter ?? '-'}</strong></td>
              <td>${escapeHTML(h.user)}</td>
            </tr>
        `;
    }).join("");
}

function renderFatCountTab() {
    const tbody = $("#fat-count-tbody");
    if (!tbody) return;

    const q = normalize($("#fat-count-search")?.value || "");
    const items = getFatItems().filter(i => !q || [i.code, i.name, i.category].some(f => normalize(f).includes(q)));

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:#64748b;">Nenhum item encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const catCls = getFatCatClass(item.category);
        return `
            <tr>
              <td><span class="fat-code-badge">${escapeHTML(item.code)}</span></td>
              <td><strong>${escapeHTML(item.name)}</strong></td>
              <td><span class="fat-cat-badge ${catCls}">${escapeHTML(item.category || 'Outros')}</span></td>
              <td>${escapeHTML(item.unit || 'un')}</td>
              <td style="font-weight:700; font-size:0.95rem;">${Number(item.qty) || 0} ${escapeHTML(item.unit || 'un')}</td>
              <td class="fat-cell-yellow">
                <input type="number" min="0" class="fat-yellow-input" data-fat-count-input="${escapeHTML(item.code)}" data-sys-qty="${Number(item.qty) || 0}" value="${Number(item.qty) || 0}">
              </td>
              <td data-fat-count-diff="${escapeHTML(item.code)}" style="font-weight:700; color:#64748b;">0 (Sem divergência)</td>
              <td>
                <button type="button" class="fat-btn fat-btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" data-fat-count-save="${escapeHTML(item.code)}">Ajustar Saldo</button>
              </td>
            </tr>
        `;
    }).join("");
}

function renderFatReferencesTab() {
    const tbody = $("#fat-ref-list-tbody");
    if (!tbody) return;
    const items = getFatItems();

    tbody.innerHTML = items.map(item => {
        const catCls = getFatCatClass(item.category);
        return `
            <tr>
              <td><span class="fat-code-badge">${escapeHTML(item.code)}</span></td>
              <td><strong>${escapeHTML(item.name)}</strong></td>
              <td><span class="fat-cat-badge ${catCls}">${escapeHTML(item.category || 'Outros')}</span></td>
              <td>${escapeHTML(item.unit || 'un')}</td>
              <td style="font-weight:600;">${Number(item.min) || 0}</td>
              <td style="font-weight:600;">${Number(item.initialQty) || 0}</td>
              <td style="font-weight:800; color:#059669;">${Number(item.qty) || 0}</td>
              <td>
                <button type="button" class="fat-mini-btn" data-fat-ref-edit="${escapeHTML(item.code)}">✏️ Editar</button>
              </td>
            </tr>
        `;
    }).join("");
}

function renderFatAuditTab() {
    const tbody = $("#fat-audit-tbody");
    if (!tbody) return;

    const searchQ = normalize($("#fat-audit-search")?.value || "");
    const typeFilter = $("#fat-audit-type")?.value || "";

    const rows = state.history.filter(h => {
        if (h.sector !== 'faturamento') return false;
        const matchSearch = !searchQ || [h.itemCode, h.itemName, h.user, h.note, h.type].some(f => normalize(f).includes(searchQ));
        const matchType = !typeFilter || h.type === typeFilter;
        return matchSearch && matchType;
    });

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#64748b;">Nenhum registro de auditoria encontrado no Faturamento.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(h => `
        <tr>
          <td style="white-space:nowrap; color:#475569;">${formatDate(h.at)}</td>
          <td><span class="fat-code-badge">${escapeHTML(h.itemCode)}</span></td>
          <td><strong>${escapeHTML(h.itemName)}</strong></td>
          <td><strong>${escapeHTML(h.type)}</strong></td>
          <td style="font-weight:700;">${escapeHTML(String(h.qty))}</td>
          <td style="color:#475569;">${h.qtyBefore ?? '-'} → <strong>${h.qtyAfter ?? '-'}</strong></td>
          <td>${escapeHTML(h.user)}</td>
          <td style="color:#64748b; font-size:0.83rem;">${escapeHTML(h.note || '-')}</td>
        </tr>
    `).join("");
}

function loadFatReferenceForEdit(code) {
    const item = getFatItems().find(i => i.code === code);
    if (!item) return;
    setFatView("referencias");
    $("#fat-ref-form-title").textContent = `✏️ Editando Referência: ${item.code}`;
    $("#fat-ref-orig-code").value = item.code;
    $("#fat-ref-code").value = item.code;
    $("#fat-ref-code").disabled = true;
    $("#fat-ref-name").value = item.name;
    $("#fat-ref-category").value = item.category || "Embalagem";
    $("#fat-ref-unit").value = item.unit || "un";
    $("#fat-ref-min").value = Number(item.min) || 0;
    $("#fat-ref-init").value = Number(item.initialQty) || 0;
    $("#fat-ref-note").value = item.note || item.supplier || "";
    $("#fat-ref-submit-btn").textContent = "Atualizar Referência";
    $("#fat-ref-cancel-edit").style.display = "inline-flex";
}

function resetFatReferenceForm() {
    const form = $("#fat-ref-form");
    if (form) form.reset();
    if ($("#fat-ref-orig-code")) $("#fat-ref-orig-code").value = "";
    if ($("#fat-ref-code")) $("#fat-ref-code").disabled = false;
    if ($("#fat-ref-form-title")) $("#fat-ref-form-title").textContent = "🏷️ Criar Nova Referência / ID";
    if ($("#fat-ref-submit-btn")) $("#fat-ref-submit-btn").textContent = "Salvar Referência / ID";
    if ($("#fat-ref-cancel-edit")) $("#fat-ref-cancel-edit").style.display = "none";
    suggestNextFatId();
}

function initFaturamentoEvents() {
    $$("[data-fat-view]").forEach(btn => {
        btn.addEventListener("click", () => setFatView(btn.dataset.fatView));
    });

    $("#fat-switch-to-tecnica")?.addEventListener("click", () => setSector("tecnica"));

    $("#fat-logout-btn")?.addEventListener("click", () => {
        clearInterval(refreshTimer);
        currentUser = null;
        $("#login-form")?.reset();
        if ($("#login-error")) $("#login-error").textContent = "";
        if ($(".app-shell")) $(".app-shell").style.display = "none";
        if ($("#faturamento-shell")) $("#faturamento-shell").style.display = "none";
        if ($("#login-screen")) $("#login-screen").style.display = "flex";
    });

    $("#fat-search-input")?.addEventListener("input", renderFatSheet);
    $("#fat-category-filter")?.addEventListener("change", renderFatSheet);
    $("#fat-status-filter")?.addEventListener("change", renderFatSheet);
    $("#fat-count-search")?.addEventListener("input", renderFatCountTab);
    $("#fat-audit-search")?.addEventListener("input", renderFatAuditTab);
    $("#fat-audit-type")?.addEventListener("change", renderFatAuditTab);

    $("#fat-jump-mov-btn")?.addEventListener("click", () => setFatView("movimentacoes"));
    $("#fat-jump-ref-btn")?.addEventListener("click", () => {
        resetFatReferenceForm();
        setFatView("referencias");
    });

    $("#fat-generate-id-btn")?.addEventListener("click", suggestNextFatId);
    $("#fat-ref-cancel-edit")?.addEventListener("click", resetFatReferenceForm);

    // Exportar Planilha Faturamento (CSV)
    $("#fat-export-sheet-btn")?.addEventListener("click", () => {
        const headers = ["ID", "Item", "Categoria", "Unidade", "Estoque Inicial", "Entradas", "Saidas", "Estoque Atual", "Estoque Minimo", "Status", "Ultima Movimentacao"];
        const rows = getFatItems().map(i => {
            const st = getFatStatus(i);
            return [
                `"${i.code}"`,
                `"${escapeHTML(i.name)}"`,
                `"${escapeHTML(i.category || '')}"`,
                `"${escapeHTML(i.unit || 'un')}"`,
                Number(i.initialQty) || 0,
                Number(i.entriesTotal) || 0,
                Number(i.exitsTotal) || 0,
                Number(i.qty) || 0,
                Number(i.min) || 0,
                `"${st.key}"`,
                `"${i.lastMovementAt ? formatDate(i.lastMovementAt) : ''}"`
            ];
        });
        exportCSV(`planilha_faturamento_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    });

    // Exportar Auditoria Faturamento (CSV)
    $("#fat-export-audit-btn")?.addEventListener("click", () => {
        const headers = ["Data", "ID", "Insumo", "Tipo", "Qtd", "Antes", "Depois", "Responsavel", "Observacao"];
        const rows = state.history.filter(h => h.sector === 'faturamento').map(h => [
            `"${formatDate(h.at)}"`,
            `"${h.itemCode}"`,
            `"${escapeHTML(h.itemName)}"`,
            `"${h.type}"`,
            h.qty,
            h.qtyBefore ?? '',
            h.qtyAfter ?? '',
            `"${escapeHTML(h.user)}"`,
            `"${escapeHTML(h.note || '')}"`
        ]);
        exportCSV(`auditoria_faturamento_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    });

    // Submissão de Movimentação (Entrada ou Saída)
    $("#fat-mov-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = $("#fat-mov-item").value;
        const type = $("#fat-mov-type").value;
        const quantity = Number($("#fat-mov-qty").value) || 1;
        const responsible = $("#fat-mov-resp").value.trim() || currentUser?.name || "Faturamento";
        const note = $("#fat-mov-note").value.trim();
        const fb = $("#fat-mov-feedback");

        if (!code) return alert("Selecione um item da lista suspensa.");

        try {
            if (fb) { fb.style.color = "#475569"; fb.textContent = "Registrando movimentação..."; }
            const res = await fetch(`${API_BASE_URL}/api/faturamento/movement`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ code, type, quantity, responsible, note })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao registrar movimentação.");

            if (fb) {
                fb.style.color = "#059669";
                fb.textContent = `✅ ${type === 'in' ? 'Entrada' : 'Saída'} registrada com sucesso! Novo saldo: ${data.current_quantity}.`;
            }
            $("#fat-mov-qty").value = "1";
            $("#fat-mov-note").value = "";
            await bootstrapApp();
        } catch (err) {
            if (fb) { fb.style.color = "#dc2626"; fb.textContent = `❌ ${err.message}`; }
            else alert(err.message);
        }
    });

    // Submissão de Criar / Editar Referência e ID
    $("#fat-ref-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const origCode = $("#fat-ref-orig-code").value.trim();
        const code = $("#fat-ref-code").value.trim().toUpperCase();
        const name = $("#fat-ref-name").value.trim();
        const category = $("#fat-ref-category").value;
        const unit = $("#fat-ref-unit").value;
        const min = Number($("#fat-ref-min").value) || 0;
        const initial_quantity = Number($("#fat-ref-init").value) || 0;
        const note = $("#fat-ref-note").value.trim();

        try {
            if (origCode) {
                const existing = getFatItems().find(i => i.code === origCode);
                const res = await fetch(`${API_BASE_URL}/api/supplies/${encodeURIComponent(origCode)}`, {
                    method: 'PUT',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        name,
                        category,
                        unit,
                        min,
                        initial_quantity,
                        qty: existing ? existing.qty : initial_quantity,
                        supplier: note,
                        note,
                        sector: 'faturamento'
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erro ao atualizar referência.");
                alert(`Referência ${origCode} atualizada com sucesso!`);
            } else {
                const res = await fetch(`${API_BASE_URL}/api/supplies`, {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        code,
                        name,
                        category,
                        unit,
                        min,
                        initial_quantity,
                        qty: initial_quantity,
                        supplier: note,
                        note,
                        sector: 'faturamento'
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erro ao criar referência.");
                alert(`Referência ${code} (${name}) criada com sucesso!`);
            }
            resetFatReferenceForm();
            await bootstrapApp();
        } catch (err) {
            alert(err.message);
        }
    });

    // Delegated events inside #faturamento-shell
    const fatShell = $("#faturamento-shell");
    if (fatShell) {
        fatShell.addEventListener("change", async (e) => {
            const initInput = e.target.closest("[data-fat-cell-init]");
            if (initInput) {
                const code = initInput.dataset.fatCellInit;
                const val = Number(initInput.value);
                if (isNaN(val) || val < 0) return;
                try {
                    const res = await fetch(`${API_BASE_URL}/api/faturamento/supplies/${encodeURIComponent(code)}/cells`, {
                        method: 'PATCH',
                        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ initial_quantity: val })
                    });
                    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                    await bootstrapApp();
                } catch (err) { alert(err.message); bootstrapApp(); }
            }

            const minInput = e.target.closest("[data-fat-cell-min]");
            if (minInput) {
                const code = minInput.dataset.fatCellMin;
                const val = Number(minInput.value);
                if (isNaN(val) || val < 0) return;
                try {
                    const res = await fetch(`${API_BASE_URL}/api/faturamento/supplies/${encodeURIComponent(code)}/cells`, {
                        method: 'PATCH',
                        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ minimum_quantity: val })
                    });
                    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                    await bootstrapApp();
                } catch (err) { alert(err.message); bootstrapApp(); }
            }
        });

        fatShell.addEventListener("input", (e) => {
            const countInput = e.target.closest("[data-fat-count-input]");
            if (countInput) {
                const code = countInput.dataset.fatCountInput;
                const sysQty = Number(countInput.dataset.sysQty) || 0;
                const physQty = Number(countInput.value) || 0;
                const diff = physQty - sysQty;
                const diffCell = fatShell.querySelector(`[data-fat-count-diff="${code}"]`);
                if (diffCell) {
                    if (diff === 0) {
                        diffCell.style.color = "#64748b";
                        diffCell.textContent = "0 (Sem divergência)";
                    } else if (diff > 0) {
                        diffCell.style.color = "#059669";
                        diffCell.textContent = `+${diff} (Sobra física)`;
                    } else {
                        diffCell.style.color = "#dc2626";
                        diffCell.textContent = `${diff} (Falta física)`;
                    }
                }
            }
        });

        fatShell.addEventListener("click", async (e) => {
            const quickIn = e.target.closest("[data-fat-quick-in]");
            if (quickIn) {
                const code = quickIn.dataset.fatQuickIn;
                setFatView("movimentacoes");
                if ($("#fat-mov-item")) $("#fat-mov-item").value = code;
                if ($("#fat-mov-type")) $("#fat-mov-type").value = "in";
                $("#fat-mov-qty")?.focus();
                return;
            }

            const quickOut = e.target.closest("[data-fat-quick-out]");
            if (quickOut) {
                const code = quickOut.dataset.fatQuickOut;
                setFatView("movimentacoes");
                if ($("#fat-mov-item")) $("#fat-mov-item").value = code;
                if ($("#fat-mov-type")) $("#fat-mov-type").value = "out";
                $("#fat-mov-qty")?.focus();
                return;
            }

            const quickEdit = e.target.closest("[data-fat-quick-edit]");
            if (quickEdit) {
                loadFatReferenceForEdit(quickEdit.dataset.fatQuickEdit);
                return;
            }

            const refEdit = e.target.closest("[data-fat-ref-edit]");
            if (refEdit) {
                loadFatReferenceForEdit(refEdit.dataset.fatRefEdit);
                return;
            }

            const countSave = e.target.closest("[data-fat-count-save]");
            if (countSave) {
                const code = countSave.dataset.fatCountSave;
                const input = fatShell.querySelector(`[data-fat-count-input="${code}"]`);
                if (!input) return;
                const physicalQty = Number(input.value);
                if (isNaN(physicalQty) || physicalQty < 0) return alert("Informe uma quantidade física válida.");
                countSave.disabled = true;
                try {
                    const res = await fetch(`${API_BASE_URL}/api/movements/adjust`, {
                        method: 'POST',
                        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ code, physicalQty })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Erro ao ajustar contagem.");
                    await bootstrapApp();
                } catch (err) {
                    alert(err.message);
                } finally {
                    countSave.disabled = false;
                }
            }
        });
    }
}
