(() => {
  const estado = { itens: [], status: "TODOS", busca: "" };
  const $ = (seletor) => document.querySelector(seletor);
  const token = () =>
    localStorage.getItem("babycareToken") ||
    sessionStorage.getItem("babycareToken") ||
    "";

  function esconderCarregamento() {
    const loader = $("#pageLoader");
    if (!loader) return;
    loader.classList.add("is-hidden");
    window.setTimeout(() => loader.remove(), 350);
  }

  function moedaNumero(valor) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
      Number(valor) || 0,
    );
  }

  function formatarData(valor) {
    if (!valor) return "Sem data";
    const partes = String(valor).slice(0, 10).split("-");
    if (partes.length !== 3) return String(valor);
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  function esc(valor) {
    return String(valor ?? "").replace(
      /[&<>'"]/g,
      (caractere) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[caractere],
    );
  }

  function classeStatus(status) {
    return (
      {
        VENCIDO: "expired",
        CRITICO: "critical",
        ATENCAO: "attention",
        NORMAL: "normal",
      }[status] || "normal"
    );
  }

  function textoStatus(status) {
    return (
      {
        VENCIDO: "Vencido",
        CRITICO: "Até 7 dias",
        ATENCAO: "Atenção",
        NORMAL: "Normal",
      }[status] || status
    );
  }

  async function requisitar() {
    const params = new URLSearchParams({
      status: estado.status,
      busca: estado.busca,
    });
    const resposta = await fetch(`/api/validade?${params}`, {
      headers: { Authorization: `Bearer ${token()}` },
      cache: "no-store",
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok)
      throw new Error(
        corpo.mensagem || "Não foi possível carregar as validades.",
      );
    return corpo;
  }

  function renderizarResumo(resumo = {}) {
    $("#totalValidity").textContent = resumo.total ?? 0;
    $("#expiredValidity").textContent = resumo.vencidos ?? 0;
    $("#criticalValidity").textContent = resumo.criticos ?? 0;
    $("#attentionValidity").textContent = resumo.atencao ?? 0;
  }

  function renderizarTabela(itens) {
    const corpo = $("#validityBody");
    corpo.replaceChildren();
    $("#validityCount").textContent =
      `${itens.length} ${itens.length === 1 ? "lote" : "lotes"}`;
    $("#validityEmpty").hidden = itens.length > 0;

    itens.forEach((item) => {
      const dias = Number(item.diasRestantes);
      const sinal =
        dias < 0
          ? `${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"} atrás`
          : `${dias} dia${dias === 1 ? "" : "s"}`;
      const linha = document.createElement("tr");
      linha.innerHTML = `<td><strong>${esc(item.produto)}</strong><small>${esc(item.codigo)}</small></td><td>${esc(item.numeroLote)}</td><td>${formatarData(item.dataValidade)}</td><td class="days ${classeStatus(item.status)}">${sinal}</td><td>${moedaNumero(item.quantidadeAtual)} ${esc(item.unidade || "")}</td><td>${esc(item.localizacao || "Não informada")}</td><td>${esc(item.fornecedor || "Não informado")}</td><td><span class="validity-badge ${classeStatus(item.status)}">${textoStatus(item.status)}</span></td>`;
      corpo.appendChild(linha);
    });
  }

  async function carregar() {
    try {
      const dados = await requisitar();
      estado.itens = Array.isArray(dados.itens) ? dados.itens : [];
      renderizarResumo(dados.resumo);
      renderizarTabela(estado.itens);
      document.body.dataset.validityState = "ready";
    } catch (erro) {
      $("#validityEmpty").hidden = false;
      $("#validityEmpty").textContent = erro.message;
      document.body.dataset.validityState = "error";
      if (/token|sessão/i.test(erro.message))
        window.location.href = "./login.html";
    } finally {
      esconderCarregamento();
    }
  }

  function atualizarFiltros() {
    estado.status = $("#validityStatus").value;
    estado.busca = $("#validitySearch").value.trim();
    carregar();
  }

  $("#validityStatus")?.addEventListener("change", atualizarFiltros);
  $("#validitySearch")?.addEventListener(
    "input",
    (() => {
      let timer;
      return () => {
        clearTimeout(timer);
        timer = setTimeout(atualizarFiltros, 250);
      };
    })(),
  );
  $("#refreshValidity")?.addEventListener("click", carregar);
  window.addEventListener("load", esconderCarregamento);
  carregar();
})();
