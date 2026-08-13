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
    usageKpis: []
};

let currentUser = null;
let currentView = "dashboard";
let withdraw = { step: 0, technician: "", isManual: false, destination: "", item: null, qty: 1 };
let refreshTimer = null;
let countItem = null;
let currentHistoryTab = 'withdrawals';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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
        const pendingUsrs = data.users.filter(u => !u.active);
        const destinations = data.destinations;
        const supplies = data.supplies;
        const movements = data.movements;
        const requests = data.requests;

        state.items = (supplies || []).map(s => ({
            ...s,
            qty: s.current_quantity || 0,
            min: s.minimum_quantity || 0,
            supplier: s.supplier || "",
            note: s.note || ""
        }));

        // Mapeamento e calculo de status "Em uso" por insumo e usuario
        const userSupplyBalance = {};
        (movements || []).slice().reverse().forEach(m => {
            const key = `${m.user_id}_${m.supply_id}`;
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
            else if (m.note && m.note.startsWith("Retirado por")) uName = escapeHTML(m.note);

            const key = `${m.user_id}_${m.supply_id}`;
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
                note: m.note || ""
            };
        });

        state.requests = (requests || []).map(r => {
            let techName = r.user_name || "Desconhecido";
            if (r.note && r.note.startsWith("Para:")) techName = `${techName} (${r.note})`;
            return {
                id: r.id,
                technician: techName,
                                qty: r.quantity || 1,
                itemCode: r.code || "-",
                itemName: r.supply_name || "Insumo Desconhecido",
                status: r.status,
                note: r.note || ""
            };
        });
        
        state.technicians = (users || []).map(u => ({ 
            name: u.name, 
            defaultDest: "Laboratório"
        }));
        state.pendingUsers = pendingUsrs || [];
        
        if (destinations && destinations.length > 0) {
            state.destinations = destinations.map(d => d.name);
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
    if (!query) return state.items;
    return state.items.filter(item => [item.code, item.name, item.category, item.supplier].some(f => normalize(f).includes(query)));
}

function filteredHistory(forTable = false) {
    const query = normalize($("#global-search")?.value || "");
    const technician = isAdmin() ? ($("#technician-filter")?.value || "") : currentUser.name;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return state.history.filter(entry => {
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
        
        return matchesSearch && matchesTech && matchesDate && matchesTab;
    });
}

function setView(view) {
    if (!isAdmin() && ["dashboard", "replenish", "count", "items"].includes(view)) {
        view = "withdraw";
    }
    currentView = view;
    $$(".view").forEach(node => node.classList.toggle("active", node.id === `${view}-view`));
    $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));

    const titleMap = { dashboard: "Painel Administrativo", withdraw: "Retirar Insumo", return: "Devolver Insumo", replenish: "Entrada (Reposição)", count: "Contagem / Auditoria", items: "Insumos", history: "Auditoria Completa" };
    if ($("#view-title")) $("#view-title").textContent = titleMap[view] || "Dashboard";

    if (view === "withdraw") {
        withdraw = { step: isAdmin() ? 0 : 2, technician: isAdmin() ? "" : currentUser.name, isManual: false, destination: state.destinations[0], item: null, qty: 1 };
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
    // NOVA REGRA: <= 1
    const criticalItems = state.items.filter(i => Number(i.qty) <= 1);

    if ($("#metric-total-items")) $("#metric-total-items").textContent = state.items.length;
    if ($("#metric-critical")) $("#metric-critical").textContent = criticalItems.length;
    if ($("#metric-withdrawals")) $("#metric-withdrawals").textContent = state.history.filter(h => h.type === "Retirada").length;
    if ($("#metric-stock")) $("#metric-stock").textContent = state.items.reduce((acc, i) => acc + Number(i.qty), 0);

    const critList = $("#critical-list");
    if (critList) {
        critList.innerHTML = criticalItems.length
            ? criticalItems.map(i => `<div class="compact-row"><span>${escapeHTML(i.name)}</span><strong style="color:#ff2a55;">${i.qty} un</strong></div>`).join("")
            : `<p class="muted">Estoque sob controle.</p>`;
    }

    const pendingRequests = state.requests.filter(r => r.status === "pending");
    if ($("#pending-count")) $("#pending-count").textContent = `${pendingRequests.length} pendentes`;

    const reqList = $("#pending-requests");
    if (reqList) {
        reqList.innerHTML = pendingRequests.length
            ? pendingRequests.map(r => {
                let warningHtml = "";
                return `
          <div class="request-card" style="padding:10px; border:1px solid #444; margin-bottom:8px; border-radius:4px;">
            <p><strong>${escapeHTML(r.technician)} </strong> solicitou ${escapeHTML(String(r.qty))}x ${escapeHTML(r.itemName)}</p>
            
            <div style="display:flex; gap:8px;">
                <button class="primary-action" data-approve="${r.id}" style="margin-top:5px; flex:1;">Liberar</button>
                <button class="danger-action" data-reject="${r.id}" style="margin-top:5px; flex:1; border:1px solid #ff4444; background:transparent; color:#ff4444; border-radius:4px; cursor:pointer;">Rejeitar</button>
            </div>
          </div>
        `}).join("")
            : `<p class="muted">Nenhuma solicitação pendente.</p>`;
            
        $$("[data-approve]").forEach(btn => btn.addEventListener("click", () => approveRequest(btn.dataset.approve, btn)));
        $$("[data-reject]").forEach(btn => btn.addEventListener("click", () => cancelRequest(btn.dataset.reject, btn)));
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
            ? `<div class="table-body">` + data.map(h => `<div class="table-row"><span>${escapeHTML(h.itemName)}</span><span>${escapeHTML(h.user)} ${h.destination && h.destination !== "-" ? `<br><small style="color:#999;">🪑 ${escapeHTML(h.destination)}</small>` : ''}</span><span>${escapeHTML(h.type)}</span><span>${formatDate(h.at)}</span></div>`).join("") + `</div>`
            : `<p class="muted">Nenhum registro.</p>`;
    }
    
    const pendUsersList = $("#pending-users");
    if (pendUsersList) {
        if ($("#pending-users-count")) $("#pending-users-count").textContent = `${state.pendingUsers.length} pendentes`;
        pendUsersList.innerHTML = state.pendingUsers.length
            ? state.pendingUsers.map(u => `
                <div class="compact-row" style="padding: 8px; border:1px solid #444; border-radius:4px; margin-bottom: 5px;">
                  <span><strong>${escapeHTML(u.name)}</strong></span>
                  <button class="primary-action" data-approve-user=\"${u.id}\" style="padding:4px 8px; font-size:0.8rem;">Aprovar</button>
                </div>
            `).join("")
            : `<p class="muted">Nenhum novo cadastro.</p>`;
    }

    renderItemsGrid();
    renderHistoryTable();
    renderTechnicianFilter();
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

function renderTechnicianFilter() {
    const select = $("#technician-filter");
    if (!select || select.options.length > 1) return;
    state.technicians.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.name; opt.textContent = t.name;
        select.appendChild(opt);
    });
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
        content.innerHTML = `
            <h3>Quem vai retirar?</h3>
            <div class="form-grid" style="margin-top:10px;">
                ${state.technicians.map(t => `<button class="primary-action" data-select-tech="${escapeHTML(t.name)}">${escapeHTML(t.name)} </button>`).join("")}
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
            <p class="muted">Técnico: ${escapeHTML(withdraw.technician)}</p>
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
            const item = state.items.find(i => normalize(i.code) === normalize($("#withdraw-code-input").value));
            if (!item) return alert("Insumo não encontrado!");
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
            <p class="muted">Técnico: ${escapeHTML(withdraw.technician)}</p>
            <div style="margin-top:10px;">
                <label style="display: block; text-align: left;">Digite o nome do produto ou equipamento:
                    <input id="request-name-input" class="scan-input" placeholder="Ex: Amperímetro, Tela iPhone..." autocomplete="off" style="width: 100%; margin-top: 5px;">
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
            const matchingItems = state.items.filter(i => normalize(i.name).includes(query) || normalize(i.code).includes(query));
            if (matchingItems.length === 0) {
                results.innerHTML = "<p class='muted' style='padding: 10px;'>Item não encontrado no catálogo. Você pode clicar no botão abaixo para solicitar como item não cadastrado!</p>";
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
        const destName = withdraw.isManual ? "Laboratório" : (techInfo?.defaultDest || "Laboratório");

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
                note = `Retirado por ${withdraw.technician}${customDest ? ' (Para: ' + customDest + ')' : ''}`;
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
                        note: note
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
        const item = state.items.find(i => normalize(i.code) === normalize(code));
        if (!item) throw new Error("Insumo não encontrado.");

        const res = await fetch(`${API_BASE_URL}/api/movements/replenish`, {
            method: 'POST', 
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ code: item.code, quantity: qty })
        });
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); }

        $("#replenish-result").textContent = "Estoque atualizado com sucesso!"; $("#replenish-code").value = ""; bootstrapApp();
    } catch (e) { $("#replenish-result").textContent = e.message; }
}

// LOGICA DE CONTAGEM / BALANÇO
function findCountItem() {
    const code = $("#count-code").value;
    countItem = state.items.find(i => normalize(i.code) === normalize(code));
    if (!countItem) {
        $("#count-result").textContent = "Referência não encontrada.";
        $("#count-details").style.display = "none";
        return;
    }
    $("#count-result").textContent = "";
    $("#count-item-name").textContent = countItem.name;
    $("#count-sys-qty").textContent = `${countItem.qty} un`;
    $("#count-phys-qty").value = countItem.qty; // Defaults to system qty
    $("#count-details").style.display = "flex";
}

async function submitCount() {
    if (!countItem) return alert("Selecione um insumo primeiro.");
    const physQty = Number($("#count-phys").value);
    if (isNaN(physQty) || physQty < 0) return alert("Quantidade inválida.");

    try {
        const res = await fetch(`${API_BASE_URL}/api/movements/adjust`, {
            method: 'POST', 
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ code: countItem.code, physicalQty: physQty })
        });
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); }
        alert(`Estoque ajustado para ${physQty}!`);
        
        countItem = null;
        $("#count-code").value = "";
        $("#count-info").style.display = "none";
        $("#count-phys").value = "";
        bootstrapApp();
    } catch (e) { alert(e.message); }
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

function openItemDialog(code = null) {
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
        $("#item-min").value = item.min; 
        $("#item-supplier").value = item.supplier || ""; 
        $("#item-note").value = item.note || "";
        } else {
        $("#dialog-title").textContent = "Nova Referência"; 
        form.reset(); 
        $("#item-original-code").value = "";
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
        setView(isAdmin() ? "dashboard" : "withdraw");
        
        bootstrapApp();
        refreshTimer = setInterval(bootstrapApp, 10000); 
    } catch (err) { $("#login-error").textContent = err.message; }
}

document.addEventListener("DOMContentLoaded", () => {
    $("#login-form")?.addEventListener("submit", handleLogin);
    $("#return-button")?.addEventListener("click", returnItem);
    $("#return-code")?.addEventListener("keydown", (e) => { if (e.key === "Enter") returnItem(); });
    
    // Contagem events
    $("#count-find-btn")?.addEventListener("click", findCountItem);
    $("#count-code")?.addEventListener("keydown", (e) => { if (e.key === "Enter") findCountItem(); });
    $("#count-submit-btn")?.addEventListener("click", submitCount);

    $("#replenish-button")?.addEventListener("click", handleReplenish);
    $("#replenish-code")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const code = $("#replenish-code").value;
            const item = state.items.find(i => normalize(i.code) === normalize(code));
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
            pin_code: $("#user-pin").value, 
            active: true 
        };
        try { 
            const res = await fetch(`${API_BASE_URL}/api/users`, {
                method: 'POST', 
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        });
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); } alert("Usuário adicionado!"); bootstrapApp(); $("#user-dialog").close(); } catch (err) { alert(err.message); }
    });

    $("#register-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = { 
            name: $("#reg-name").value, 
            pin: $("#reg-pin").value 
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

    $("#logout-button")?.addEventListener("click", () => {
        clearInterval(refreshTimer); currentUser = null; $("#login-form").reset(); $("#login-error").textContent = ""; $("#login-screen").style.display = "flex";
    });

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
    });
});

function renderSearchResults() {
    const input = $("#global-search"); const resultsDiv = $("#search-results");
    if (!input || !resultsDiv) return;
    const query = normalize(input.value);
    if (!query) { resultsDiv.style.display = "none"; return; }
    const matchingItems = state.items.filter(i => normalize(i.name).includes(query) || normalize(i.code).includes(query));
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
