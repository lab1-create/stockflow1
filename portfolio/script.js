document.addEventListener("DOMContentLoaded", () => {
  // 1. Alternador de Telas do StockFlow (Faturamento / Assistência Técnica)
  document.querySelectorAll("[data-sf-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.sfView;
      document.querySelectorAll("[data-sf-view]").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".sf-stage").forEach(st => st.classList.toggle("active", st.id === `sf-view-${target}`));
    });
  });

  // 2. Copiar Post do LinkedIn
  const copyPostBtn = document.getElementById("copy-post-btn");
  const linkedinText = document.getElementById("linkedin-text");
  copyPostBtn?.addEventListener("click", () => {
    if (!linkedinText) return;
    navigator.clipboard.writeText(linkedinText.textContent).then(() => {
      const orig = copyPostBtn.textContent;
      copyPostBtn.textContent = "✅ Texto Copiado!";
      setTimeout(() => { copyPostBtn.textContent = orig; }, 2200);
    });
  });

  // 3. Copiar Link do Portfólio
  const copyUrlBtn = document.getElementById("copy-url-btn");
  copyUrlBtn?.addEventListener("click", () => {
    const url = window.location.href.startsWith("http")
      ? window.location.href
      : "https://stockflow-outlet.web.app/portfolio/";
    navigator.clipboard.writeText(url).then(() => {
      const orig = copyUrlBtn.textContent;
      copyUrlBtn.textContent = "✅ Link Copiado!";
      setTimeout(() => { copyUrlBtn.textContent = orig; }, 2200);
    });
  });

  // ===================================================================
  // 4. PLAYER CINEMA DOM HD — DEMONSTRAÇÃO AUTOMÁTICA DO ROBÔ DATASYS
  // ===================================================================
  const cursor = document.getElementById("demo-cursor");
  const ripple = document.getElementById("cursor-ripple");
  const imeiBox = document.getElementById("demo-imei-box");
  const validBadge = document.getElementById("demo-valid-badge");
  const startBtn = document.getElementById("demo-start-btn");
  const pctText = document.getElementById("demo-pct-text");
  const progressFill = document.getElementById("demo-progress-fill");
  const logLine = document.getElementById("demo-log-line");
  const phaseLabel = document.getElementById("rpa-phase-label");
  const playBtn = document.getElementById("cinema-play-btn");
  const stepBtns = document.querySelectorAll(".c-step");

  const IMEIS = [
    "358912049182731",
    "354091827364519",
    "013948172635490",
    "359981726354112"
  ];

  let isPlaying = true;
  let stepIndex = 0;
  let subTimers = [];

  function clearSubTimers() {
    subTimers.forEach(t => clearTimeout(t));
    subTimers = [];
  }

  function schedule(fn, delay) {
    const id = setTimeout(() => {
      if (isPlaying) fn();
    }, delay);
    subTimers.push(id);
  }

  function moveCursor(x, y, click = false) {
    if (!cursor) return;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    if (click && ripple) {
      ripple.classList.remove("click-anim");
      void ripple.offsetWidth;
      ripple.classList.add("click-anim");
    }
  }

  function setDeviceState(idx, state) {
    const row = document.querySelector(`.rpa-device-row[data-dev="${idx}"]`);
    const badge = document.getElementById(`dev-st-${idx}`);
    if (!row || !badge) return;

    row.classList.remove("active-row", "done-row");
    badge.classList.remove("st-working", "st-done");

    if (state === "waiting") {
      badge.textContent = "Na fila";
    } else if (state === "working") {
      row.classList.add("active-row");
      badge.classList.add("st-working");
      badge.textContent = "⚡ Movendo...";
    } else if (state === "done") {
      row.classList.add("done-row");
      badge.classList.add("st-done");
      badge.textContent = "✓ Transferido";
    }
  }

  function highlightStepBtn(idx) {
    stepBtns.forEach(b => b.classList.toggle("active", Number(b.dataset.step) === idx));
  }

  function runScene(idx) {
    clearSubTimers();
    stepIndex = idx;
    highlightStepBtn(idx);

    if (idx === 0) {
      // CENA 1: COLANDO OS IMEIS
      if (phaseLabel) phaseLabel.textContent = "Passo 1: Colando lista de IMEIs";
      if (imeiBox) {
        imeiBox.innerHTML = "";
        imeiBox.classList.remove("focused");
      }
      if (validBadge) validBadge.textContent = "Aguardando lista...";
      if (startBtn) {
        startBtn.className = "rpa-start-btn";
        startBtn.textContent = "▶ Iniciar Movimentação no DataSys";
      }
      if (pctText) pctText.textContent = "0%";
      if (progressFill) progressFill.style.width = "0%";
      for (let i = 0; i < 4; i++) setDeviceState(i, "waiting");
      if (logLine) logLine.textContent = "[READY] Painel pronto. Aguardando colagem dos códigos IMEI...";

      moveCursor(140, 195, false);

      schedule(() => {
        moveCursor(140, 195, true);
        imeiBox?.classList.add("focused");
        if (logLine) logLine.textContent = "[INPUT] Colando e validando seriais de 15 dígitos...";
      }, 600);

      IMEIS.forEach((code, i) => {
        schedule(() => {
          if (!imeiBox) return;
          const div = document.createElement("div");
          div.className = "imei-chip";
          div.innerHTML = `<code>${code}</code><span>✓ 15 dígitos</span>`;
          imeiBox.appendChild(div);
          if (validBadge) validBadge.textContent = `${i + 1} válidos (15 dígitos)`;
        }, 1000 + i * 320);
      });

      schedule(() => runScene(1), 3000);
    } else if (idx === 1) {
      // CENA 2: CLICANDO EM INICIAR ROBÔ
      if (phaseLabel) phaseLabel.textContent = "Passo 2: Iniciando Automação";
      if (imeiBox && imeiBox.children.length === 0) {
        imeiBox.innerHTML = IMEIS.map(c => `<div class="imei-chip"><code>${c}</code><span>✓ 15 dígitos</span></div>`).join("");
      }
      if (validBadge) validBadge.textContent = "4 válidos (15 dígitos)";

      moveCursor(175, 340, false);

      schedule(() => {
        moveCursor(175, 340, true);
        startBtn?.classList.add("pressed");
      }, 650);

      schedule(() => {
        startBtn?.classList.remove("pressed");
        startBtn?.classList.add("running");
        if (startBtn) startBtn.textContent = "⚡ Robô Executando no Chrome...";
        if (logLine) logLine.textContent = "[PLAYWRIGHT] Google Chrome aberto -> Login OUTLETDOCELULAR -> Baixando Estoque...";
      }, 1050);

      schedule(() => runScene(2), 2500);
    } else if (idx === 2) {
      // CENA 3: MOVIMENTANDO OS 4 APARELHOS NO DATASYS
      if (phaseLabel) phaseLabel.textContent = "Passo 3: Transferindo no DataSys";
      if (startBtn) {
        startBtn.className = "rpa-start-btn running";
        startBtn.textContent = "⚡ Robô Executando no Chrome...";
      }
      moveCursor(560, 120, false);

      for (let i = 0; i < 4; i++) {
        schedule(() => {
          setDeviceState(i, "working");
          moveCursor(580, 125 + i * 58, false);
          if (logLine) logLine.textContent = `[DATASYS] Transferindo IMEI ${IMEIS[i]} para o depósito TRIAGEM...`;
        }, i * 1050);

        schedule(() => {
          setDeviceState(i, "done");
          const pct = (i + 1) * 25;
          if (pctText) pctText.textContent = `${pct}%`;
          if (progressFill) progressFill.style.width = `${pct}%`;
        }, i * 1050 + 750);
      }

      schedule(() => runScene(3), 4500);
    } else if (idx === 3) {
      // CENA 4: CONCLUÍDO COM RELATÓRIO EXCEL
      if (phaseLabel) phaseLabel.textContent = "Passo 4: Concluído (Excel Gerado)";
      for (let i = 0; i < 4; i++) setDeviceState(i, "done");
      if (pctText) pctText.textContent = "100%";
      if (progressFill) progressFill.style.width = "100%";
      if (startBtn) {
        startBtn.className = "rpa-start-btn running";
        startBtn.textContent = "✓ 4/4 Aparelhos Movimentados!";
      }
      if (logLine) {
        logLine.style.color = "#34d399";
        logLine.textContent = "✅ [CONCLUÍDO] 4/4 transferidos p/ TRIAGEM · Planilha 'resultado_datasys.xlsx' salva!";
      }

      schedule(() => {
        if (logLine) logLine.style.color = "#93c5fd";
        runScene(0);
      }, 3400);
    }
  }

  stepBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      isPlaying = true;
      if (playBtn) playBtn.textContent = "⏸ Pausar";
      runScene(Number(btn.dataset.step));
    });
  });

  playBtn?.addEventListener("click", () => {
    isPlaying = !isPlaying;
    playBtn.textContent = isPlaying ? "⏸ Pausar" : "▶ Continuar";
    if (isPlaying) {
      runScene(stepIndex);
    } else {
      clearSubTimers();
    }
  });

  runScene(0);
});
