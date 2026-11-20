document.addEventListener("DOMContentLoaded", () => {
  // Copiar post do LinkedIn
  const copyPostBtn = document.getElementById("copy-post-btn");
  const linkedinText = document.getElementById("linkedin-text");
  copyPostBtn?.addEventListener("click", () => {
    if (!linkedinText) return;
    navigator.clipboard.writeText(linkedinText.textContent).then(() => {
      const orig = copyPostBtn.textContent;
      copyPostBtn.textContent = "✓ Copiado!";
      setTimeout(() => { copyPostBtn.textContent = orig; }, 2200);
    });
  });

  // Copiar URL do portfólio
  const copyUrlBtn = document.getElementById("copy-url-btn");
  copyUrlBtn?.addEventListener("click", () => {
    const url = window.location.href.startsWith("http")
      ? window.location.href
      : "https://stockflow-outlet.web.app/portfolio/";
    navigator.clipboard.writeText(url).then(() => {
      const orig = copyUrlBtn.textContent;
      copyUrlBtn.textContent = "✓ Link copiado!";
      setTimeout(() => { copyUrlBtn.textContent = orig; }, 2200);
    });
  });

  // =========================================================================
  // VÍDEO EM CANVAS 60FPS — GRAVAÇÃO SIMULADA DA TELA DO ROBÔ DATASYS
  // =========================================================================
  const canvas = document.getElementById("rpa-video-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const toggleBtn = document.getElementById("v-toggle-btn");
  const timeline = document.getElementById("v-timeline");
  const progressEl = document.getElementById("v-timeline-progress");
  const timerEl = document.getElementById("v-timer");
  const wrapper = document.getElementById("video-canvas-wrapper");

  const DURATION = 14.0; // 14 segundos de vídeo contínuo
  let currentTime = 0;
  let isPlaying = true;
  let lastFrameTs = performance.now();

  const IMEI_LIST = [
    { imei: "358912049182731", model: "iPhone 13 128GB", from: "ESTOQUE GERAL" },
    { imei: "354091827364519", model: "iPhone 11 64GB", from: "LABORATÓRIO" },
    { imei: "013948172635490", model: "Galaxy S22 128GB", from: "ASSISTÊNCIA" },
    { imei: "359981726354112", model: "iPhone 12 128GB", from: "QUARENTENA" }
  ];

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function lerp(a, b, t) {
    const clamped = Math.max(0, Math.min(1, t));
    return a + (b - a) * clamped;
  }

  function drawCursor(x, y, clicking = false) {
    ctx.save();
    ctx.translate(x, y);
    if (clicking) {
      ctx.beginPath();
      ctx.arc(4, 4, 16, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(5, 14);
    ctx.lineTo(9, 21);
    ctx.lineTo(12, 19);
    ctx.lineTo(8, 12);
    ctx.lineTo(14, 12);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#09090b";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function renderFrame(t) {
    const W = canvas.width;
    const H = canvas.height;

    // Fundo da área de trabalho
    ctx.fillStyle = "#07090e";
    ctx.fillRect(0, 0, W, H);

    // =========================================================
    // JANELA ESQUERDA: PAINEL DO ROBÔ DATASYS AUTOMOVE RPA
    // =========================================================
    const lx = 24, ly = 22, lw = 380, lh = 395;
    roundRect(lx, ly, lw, lh, 10);
    ctx.fillStyle = "#0f1420";
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cabeçalho janela esquerda
    roundRect(lx, ly, lw, 36, [10, 10, 0, 0]);
    ctx.fillStyle = "#161f30";
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 12.5px Inter, sans-serif";
    ctx.fillText("🤖 DataSys AutoMove RPA", lx + 14, ly + 22);

    // Status pill no topo do robô
    const isRobotActive = t >= 3.2 && t < 12.2;
    const isRobotDone = t >= 12.2;
    roundRect(lx + lw - 105, ly + 8, 92, 20, 10);
    ctx.fillStyle = isRobotDone ? "rgba(16,185,129,0.2)" : (isRobotActive ? "rgba(56,189,248,0.2)" : "#1e293b");
    ctx.fill();
    ctx.fillStyle = isRobotDone ? "#34d399" : (isRobotActive ? "#38bdf8" : "#94a3b8");
    ctx.font = "bold 10px JetBrains Mono, monospace";
    ctx.fillText(isRobotDone ? "● CONCLUÍDO" : (isRobotActive ? "● RODANDO" : "● PRONTO"), lx + lw - 95, ly + 21);

    // Campo Depósito de Destino
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 11px Inter, sans-serif";
    ctx.fillText("1. Depósito de Destino no DataSys:", lx + 16, ly + 60);

    roundRect(lx + 16, ly + 68, lw - 32, 32, 6);
    ctx.fillStyle = "#090d14";
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.fillText("📦 TRIAGEM (OUTLETDOCELULAR)", lx + 26, ly + 88);

    // Campo Lista de IMEIs
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 11px Inter, sans-serif";
    ctx.fillText("2. Lista de IMEIs colada pelo operador:", lx + 16, ly + 122);

    roundRect(lx + 16, ly + 130, lw - 32, 130, 6);
    ctx.fillStyle = "#090d14";
    ctx.fill();
    ctx.strokeStyle = t >= 0.8 && t < 2.8 ? "#38bdf8" : "#334155";
    ctx.stroke();

    // IMEIs sendo colados entre t=1.0s e t=2.2s
    const visibleImeis = t < 1.0 ? 0 : (t < 1.4 ? 2 : 4);
    for (let i = 0; i < visibleImeis; i++) {
      const rowY = ly + 152 + i * 26;
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px JetBrains Mono, monospace";
      ctx.fillText(IMEI_LIST[i].imei, lx + 28, rowY);

      // Tag 15 dígitos OK
      roundRect(lx + lw - 125, rowY - 12, 95, 17, 4);
      ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 9.5px Inter, sans-serif";
      ctx.fillText("✓ 15 dígitos OK", lx + lw - 118, rowY);
    }

    // Botão Iniciar Movimentação
    const btnClicked = t >= 2.9 && t <= 3.4;
    roundRect(lx + 16, ly + 275, lw - 32, 38, 7);
    ctx.fillStyle = btnClicked ? "#0284c7" : (t >= 3.2 ? "#1e293b" : "#0ea5e9");
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12.5px Inter, sans-serif";
    ctx.fillText(
      isRobotDone ? "✓ Movimentação Finalizada" : (t >= 3.2 ? "⚡ Robô Trabalhando..." : "▶ Iniciar Movimentação Automática"),
      lx + 72,
      ly + 298
    );

    // Barra de Progresso dentro do Robô
    const movedCount = t < 6.5 ? 0 : Math.min(4, Math.floor((t - 6.0) / 1.3));
    const pct = t < 6.0 ? 0 : Math.min(100, Math.round(((t - 6.0) / 5.2) * 100));

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText(`Progresso do lote: ${movedCount} de 4 aparelhos`, lx + 16, ly + 338);
    ctx.fillText(`${pct}%`, lx + lw - 44, ly + 338);

    roundRect(lx + 16, ly + 346, lw - 32, 10, 5);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    if (pct > 0) {
      roundRect(lx + 16, ly + 346, ((lw - 32) * pct) / 100, 10, 5);
      ctx.fillStyle = "#10b981";
      ctx.fill();
    }

    // =========================================================
    // JANELA DIREITA: GOOGLE CHROME — SISTEMA DATASYS ERP
    // =========================================================
    const rx = 424, ry = 22, rw = 472, rh = 395;
    roundRect(rx, ry, rw, rh, 10);
    ctx.fillStyle = "#0f1420";
    ctx.fill();
    ctx.strokeStyle = isRobotActive ? "#38bdf8" : "#1e293b";
    ctx.lineWidth = isRobotActive ? 2 : 1.5;
    ctx.stroke();

    // Cabeçalho do navegador Chrome
    roundRect(rx, ry, rw, 36, [10, 10, 0, 0]);
    ctx.fillStyle = "#161f30";
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.fillText("🌐 Google Chrome — DataSys ERP (Controlado pelo Robô)", rx + 14, ry + 22);

    if (t < 3.4) {
      // Aguardando início
      ctx.fillStyle = "#64748b";
      ctx.font = "13px Inter, sans-serif";
      ctx.fillText("Aguardando comando do painel ao lado...", rx + 115, ry + 210);
    } else if (t < 6.0) {
      // Etapa de login e download automático da planilha
      roundRect(rx + 24, ry + 64, rw - 48, 70, 8);
      ctx.fillStyle = "#090d14";
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 12.5px Inter, sans-serif";
      ctx.fillText("✓ 1. Login automático realizado no DataSys (OUTLETDOCELULAR)", rx + 38, ry + 92);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11.5px Inter, sans-serif";
      ctx.fillText("Robô acessou Administrativo ➔ Relatórios ➔ Estoque de Seriais", rx + 38, ry + 114);

      if (t >= 4.5) {
        roundRect(rx + 24, ry + 150, rw - 48, 75, 8);
        ctx.fillStyle = "#090d14";
        ctx.fill();
        ctx.strokeStyle = "#38bdf8";
        ctx.stroke();
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 12.5px Inter, sans-serif";
        ctx.fillText("⚡ 2. Planilha de estoque baixada e limpa com Pandas", rx + 38, ry + 178);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11.5px Inter, sans-serif";
        ctx.fillText("4 aparelhos localizados. Iniciando transferência automática...", rx + 38, ry + 200);
      }
    } else {
      // Tabela do DataSys transferindo cada aparelho ao vivo
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillText("TRANSFERÊNCIA AUTOMÁTICA DE ESTOQUE NO DATASYS:", rx + 20, ry + 62);

      for (let i = 0; i < 4; i++) {
        const item = IMEI_LIST[i];
        const cardY = ry + 76 + i * 64;
        const itemStart = 6.0 + i * 1.3;
        const isDone = t >= itemStart + 0.9;
        const isCurrent = t >= itemStart && !isDone;

        roundRect(rx + 20, cardY, rw - 40, 54, 8);
        ctx.fillStyle = isDone ? "rgba(16, 185, 129, 0.08)" : (isCurrent ? "rgba(56, 189, 248, 0.12)" : "#090d14");
        ctx.fill();
        ctx.strokeStyle = isDone ? "rgba(16, 185, 129, 0.4)" : (isCurrent ? "#38bdf8" : "#1e293b");
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.fillText(`${item.model}`, rx + 34, cardY + 22);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px JetBrains Mono, monospace";
        ctx.fillText(`IMEI: ${item.imei}`, rx + 34, cardY + 40);

        // Status da linha
        if (isDone) {
          roundRect(rx + rw - 175, cardY + 15, 142, 24, 6);
          ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
          ctx.fill();
          ctx.fillStyle = "#34d399";
          ctx.font = "bold 11px Inter, sans-serif";
          ctx.fillText("✓ Movido p/ TRIAGEM", rx + rw - 165, cardY + 31);
        } else if (isCurrent) {
          roundRect(rx + rw - 175, cardY + 15, 142, 24, 6);
          ctx.fillStyle = "rgba(56, 189, 248, 0.2)";
          ctx.fill();
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 11px Inter, sans-serif";
          ctx.fillText("⚡ Transferindo...", rx + rw - 155, cardY + 31);
        } else {
          ctx.fillStyle = "#64748b";
          ctx.font = "11px Inter, sans-serif";
          ctx.fillText(`Origem: ${item.from}`, rx + rw - 170, cardY + 31);
        }
      }

      // Banner final de Excel gerado
      if (t >= 11.8) {
        roundRect(rx + 20, ry + 338, rw - 40, 42, 8);
        ctx.fillStyle = "#064e3b";
        ctx.fill();
        ctx.strokeStyle = "#10b981";
        ctx.stroke();
        ctx.fillStyle = "#ecfdf5";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.fillText("🎉 Concluído! Planilha 'resultado_datasys.xlsx' gerada com sucesso.", rx + 34, ry + 363);
      }
    }

    // =========================================================
    // LEGENDA EXPLICATIVA NA PARTE INFERIOR DO VÍDEO
    // =========================================================
    roundRect(24, 428, W - 48, 38, 8);
    ctx.fillStyle = "#111827";
    ctx.fill();

    let caption = "PASSO 1: O operador cola os códigos IMEI de 15 dígitos no painel do robô.";
    if (t >= 2.6 && t < 4.0) {
      caption = "PASSO 2: Com 1 clique em 'Iniciar Movimentação', o robô assume o trabalho.";
    } else if (t >= 4.0 && t < 6.2) {
      caption = "PASSO 3: O robô abre o Chrome sozinho, entra no DataSys e baixa o estoque.";
    } else if (t >= 6.2 && t < 11.8) {
      caption = "PASSO 4: O robô transfere cada aparelho automaticamente para o setor TRIAGEM.";
    } else if (t >= 11.8) {
      caption = "RESULTADO: 100% dos aparelhos transferidos em segundos e relatório Excel salvo!";
    }

    ctx.fillStyle = "#f8fafc";
    ctx.font = "500 13px Inter, sans-serif";
    ctx.fillText(caption, 42, 452);

    // =========================================================
    // CURSOR DO MOUSE ANIMADO (NOS PRIMEIROS 3.5 SEGUNDOS)
    // =========================================================
    if (t < 3.6) {
      let cx = 200, cy = 200, clicking = false;
      if (t < 1.0) {
        cx = lerp(320, lx + 120, t / 1.0);
        cy = lerp(100, ly + 180, t / 1.0);
      } else if (t < 1.3) {
        cx = lx + 120;
        cy = ly + 180;
        clicking = true;
      } else if (t < 2.8) {
        cx = lerp(lx + 120, lx + 180, (t - 1.3) / 1.5);
        cy = lerp(ly + 180, ly + 295, (t - 1.3) / 1.5);
      } else {
        cx = lx + 180;
        cy = ly + 295;
        clicking = t >= 2.85 && t <= 3.25;
      }
      drawCursor(cx, cy, clicking);
    }
  }

  function formatSec(s) {
    const sec = Math.floor(s);
    return `0:${String(sec).padStart(2, "0")}`;
  }

  function updateControlsUI() {
    if (progressEl) {
      progressEl.style.width = `${(currentTime / DURATION) * 100}%`;
    }
    if (timerEl) {
      timerEl.textContent = `${formatSec(currentTime)} / 0:14`;
    }
  }

  function loop(now) {
    const dt = (now - lastFrameTs) / 1000;
    lastFrameTs = now;

    if (isPlaying) {
      currentTime += dt;
      if (currentTime >= DURATION) {
        currentTime = 0;
      }
      updateControlsUI();
    }

    renderFrame(currentTime);
    requestAnimationFrame(loop);
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    if (toggleBtn) {
      toggleBtn.textContent = isPlaying ? "⏸" : "▶";
    }
  }

  toggleBtn?.addEventListener("click", togglePlay);
  wrapper?.addEventListener("click", togglePlay);

  timeline?.addEventListener("click", (e) => {
    const rect = timeline.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    currentTime = pct * DURATION;
    updateControlsUI();
    renderFrame(currentTime);
  });

  requestAnimationFrame(loop);
});
