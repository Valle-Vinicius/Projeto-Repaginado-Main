const AUDIT_API = `${window.BabycareUI.API_URL}/api/auditorias`;
const auditEl = {
  period: document.querySelector("#auditPeriod"),
  result: document.querySelector("#auditResult"),
  action: document.querySelector("#auditAction"),
  search: document.querySelector("#auditSearch"),
  refresh: document.querySelector("#refreshAuditButton"),
  body: document.querySelector("#auditBody"),
  empty: document.querySelector("#auditEmpty"),
  count: document.querySelector("#auditCount"),
  total: document.querySelector("#auditTotal"),
  success: document.querySelector("#auditSuccess"),
  failure: document.querySelector("#auditFailure"),
  users: document.querySelector("#auditUsers"),
  side: document.querySelector("#sidebarSearch"),
  open: document.querySelector("#openSidebarButton"),
  close: document.querySelector("#closeSidebarButton"),
  logout: document.querySelector("#logoutButton"),
  bell: document.querySelector("#notificationButton"),
};
let buscaTimer;
function auditToken() {
  return (
    localStorage.getItem("babycareToken") ||
    sessionStorage.getItem("babycareToken")
  );
}
function auditEsc(v) {
  const d = document.createElement("div");
  d.textContent = v ?? "";
  return d.innerHTML;
}
function auditDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(d);
}
function auditDetails(v) {
  if (!v || typeof v !== "object") return "—";
  const parts = Object.entries(v)
    .filter(([, x]) => x !== null && x !== undefined && x !== "")
    .slice(0, 4)
    .map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : x}`);
  return parts.join(" · ") || "—";
}
async function fetchAudit() {
  const params = new URLSearchParams({
    periodo: auditEl.period.value,
    resultado: auditEl.result.value,
    acao: auditEl.action.value,
    busca: auditEl.search.value.trim(),
    _atualizacao: Date.now(),
  });
  const response = await fetch(`${AUDIT_API}?${params}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${auditToken()}`,
      "Cache-Control": "no-cache",
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const e = new Error(
      body.mensagem || "Não foi possível consultar a auditoria.",
    );
    e.status = response.status;
    throw e;
  }
  return body.dados || {};
}
function renderActions(actions) {
  const current = auditEl.action.value;
  auditEl.action.innerHTML = '<option value="">Todas as ações</option>';
  (actions || []).forEach((action) =>
    auditEl.action.appendChild(new Option(action, action)),
  );
  if ((actions || []).includes(current)) auditEl.action.value = current;
}
function render(data) {
  const r = data.resumo || {};
  auditEl.total.textContent = window.BabycareUI.formatarNumero(r.total || 0);
  auditEl.success.textContent = window.BabycareUI.formatarNumero(
    r.sucessos || 0,
  );
  auditEl.failure.textContent = window.BabycareUI.formatarNumero(r.falhas || 0);
  auditEl.users.textContent = window.BabycareUI.formatarNumero(r.usuarios || 0);
  const rows = data.eventos || [];
  auditEl.body.replaceChildren();
  auditEl.count.textContent = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
  auditEl.empty.hidden = rows.length > 0;
  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const status = String(item.resultado || "").toLowerCase();
    const entity = item.entidade
      ? `${item.entidade}${item.entidadeId ? ` #${item.entidadeId}` : ""}`
      : "—";
    tr.innerHTML = `<td>${auditEsc(auditDate(item.criadoEm))}</td><td>${auditEsc(item.usuario)}<small> · ${auditEsc(item.perfil)}</small></td><td>${auditEsc(item.acao)}</td><td>${auditEsc(entity)}</td><td><span class="audit-status ${status}">${status === "sucesso" ? "Sucesso" : "Falha"}</span></td><td title="${auditEsc(auditDetails(item.detalhes))}">${auditEsc(auditDetails(item.detalhes))}</td>`;
    auditEl.body.appendChild(tr);
  });
}
async function loadAudit() {
  window.BabycareUI.mostrarCarregamento("Carregando auditoria...");
  try {
    const data = await fetchAudit();
    renderActions(data.acoes);
    render(data);
  } catch (e) {
    if ([401, 403].includes(e.status)) {
      location.href = "/pages/login.html";
      return;
    }
    window.BabycareUI.mostrarToast(e.message, "error");
  } finally {
    window.BabycareUI.esconderCarregamento();
  }
}
function updateUser() {
  const raw =
    localStorage.getItem("babycareUsuario") ||
    sessionStorage.getItem("babycareUsuario") ||
    localStorage.getItem("babycareUser") ||
    sessionStorage.getItem("babycareUser");
  let u = {};
  try {
    u = raw ? JSON.parse(raw) : {};
  } catch (e) {}
  const name = u.nome?.trim() || "Usuário Babycare";
  const role = String(u.perfil || "Perfil de acesso")
    .replace(/_/g, " ")
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)\S/g, (x) => x.toLocaleUpperCase("pt-BR"));
  const p = name.split(/\s+/).filter(Boolean);
  const initials = (
    p.length > 1 ? p[0][0] + p.at(-1)[0] : name.slice(0, 2)
  ).toUpperCase();
  ["sidebarUserName", "topbarUserName"].forEach((id) => {
    const x = document.getElementById(id);
    if (x) x.textContent = name;
  });
  ["sidebarUserRole", "topbarUserRole"].forEach((id) => {
    const x = document.getElementById(id);
    if (x) x.textContent = role;
  });
  ["sidebarAvatar", "topbarAvatar"].forEach((id) => {
    const x = document.getElementById(id);
    if (x) x.textContent = initials;
  });
}
function setupAudit() {
  updateUser();
  [auditEl.period, auditEl.result, auditEl.action].forEach((x) =>
    x.addEventListener("change", loadAudit),
  );
  auditEl.search.addEventListener("input", () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(loadAudit, 350);
  });
  auditEl.refresh.addEventListener("click", loadAudit);
  auditEl.open?.addEventListener("click", () =>
    document.body.classList.add("sidebar-open"),
  );
  auditEl.close?.addEventListener("click", () =>
    document.body.classList.remove("sidebar-open"),
  );
  document
    .querySelectorAll(".nav-link")
    .forEach((x) =>
      x.addEventListener("click", () =>
        document.body.classList.remove("sidebar-open"),
      ),
    );
  auditEl.side?.addEventListener("input", () => {
    const term = auditEl.side.value.toLocaleLowerCase("pt-BR");
    document
      .querySelectorAll(".main-nav .nav-link")
      .forEach(
        (x) =>
          (x.hidden =
            Boolean(term) &&
            !x.textContent.toLocaleLowerCase("pt-BR").includes(term)),
      );
  });
  auditEl.bell?.addEventListener("click", () =>
    window.BabycareUI.mostrarToast(
      "Auditoria consultada com dados atuais do banco.",
    ),
  );
  auditEl.logout?.addEventListener("click", () => {
    localStorage.removeItem("babycareToken");
    sessionStorage.removeItem("babycareToken");
    localStorage.removeItem("babycareUsuario");
    sessionStorage.removeItem("babycareUsuario");
    location.href = "/pages/login.html";
  });
}
window.addEventListener("load", () => {
  setupAudit();
  loadAudit();
});
