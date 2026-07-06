function startRealtimeRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (liveEvents) liveEvents.close();
  refreshTimer = null;
  liveEvents = null;

  if (!usingApi || !currentUser) return;

  // 1. Tenta usar a conexão em tempo real nativa (Server-Sent Events)
  if ("EventSource" in window) {
    liveEvents = new EventSource(`${API_BASE}/events`);
    
    liveEvents.addEventListener("state", (event) => {
      applyLiveState(JSON.parse(event.data));
    });
    
    liveEvents.addEventListener("error", () => {
      console.warn("Conexão SSE perdida. Ativando contingência por polling seguro...");
      liveEvents?.close();
      liveEvents = null;
      
      // 2. Se o tempo real falhar por rede, ativa o Polling de Contingência com tempo seguro (10 segundos)
      if (!refreshTimer) {
        refreshTimer = setInterval(refreshFromApi, 10000);
      }
    });
    return;
  }

  // Fallback padrão caso o navegador não suporte EventSource (bancos antigos)
  refreshTimer = setInterval(refreshFromApi, 10000);
}
