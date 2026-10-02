const API = "/api/usuarios";
const $ = (s) => document.querySelector(s);
let opcoes = { perfis: [], departamentos: [] },
  editando = null;
function token() {
  return (
    localStorage.getItem("babycareToken") ||
    sessionStorage.getItem("babycareToken")
  );
}
function usuarioAtual() {
  const raw =
    localStorage.getItem("babycareUsuario") ||
    sessionStorage.getItem("babycareUsuario") ||
    localStorage.getItem("babycareUser") ||
    sessionStorage.getItem("babycareUser");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function temPermissaoGestao() {
  return ["GERENTE", "ADMINISTRADOR"].includes(
    String(usuarioAtual().perfil || "").toUpperCase(),
  );
}
function esc(v) {
  const d = document.createElement("div");
  d.textContent = v ?? "";
  return d.innerHTML;
}
function data(v) {
  if (!v) return "Nunca";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(d);
}
function role(v) {
  return String(v || "")
    .replace(/_/g, " ")
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)\S/g, (x) => x.toLocaleUpperCase("pt-BR"));
}
async function requisitar(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(opts.headers || {}),
    },
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(b.mensagem || "Não foi possível concluir a operação.");
    e.status = r.status;
    throw e;
  }
  return b;
}
async function carregarOpcoes() {
  const b = await requisitar(`${API}/opcoes`);
  opcoes = { perfis: b.perfis || [], departamentos: b.departamentos || [] };
  $("#filtroPerfil").innerHTML =
    '<option value="">Todos os perfis</option>' +
    opcoes.perfis
      .map((x) => `<option value="${x.id}">${esc(role(x.nome))}</option>`)
      .join("");
  $("#perfil").innerHTML = opcoes.perfis
    .map(
      (x) =>
        `<option value="${x.id}" data-nome="${esc(x.nome)}">${esc(role(x.nome))}</option>`,
    )
    .join("");
  $("#departamento").innerHTML =
    '<option value="">Sem departamento</option>' +
    opcoes.departamentos
      .map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`)
      .join("");
}
async function carregar() {
  const q = new URLSearchParams({
    busca: $("#busca").value,
    perfilId: $("#filtroPerfil").value,
    ativo: $("#filtroAtivo").value,
  });
  try {
    const b = await requisitar(`${API}?${q}`);
    render(b.usuarios || []);
  } catch (e) {
    if ([401, 403].includes(e.status)) {
      location.href = "./login.html";
      return;
    }
    $("#tabela").innerHTML =
      `<tr><td colspan="7" class="empty">${esc(e.message)}</td></tr>`;
  }
}
function render(items) {
  $("#contador").textContent =
    `${items.length} usuário${items.length === 1 ? "" : "s"}`;
  $("#tabela").innerHTML = items.length
    ? items
        .map(
          (x) =>
            `<tr><td><strong>${esc(x.nome)}</strong></td><td>${esc(x.email)}</td><td>${esc(role(x.perfil))}</td><td>${esc(x.departamento || "—")}</td><td><span class="status ${x.ativo ? "active" : "inactive"}">${x.ativo ? "Ativo" : "Inativo"}</span></td><td>${esc(data(x.ultimoLoginEm))}</td><td><button class="edit-button" data-edit="${x.id}">Editar</button></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="7" class="empty">Nenhum usuário encontrado.</td></tr>';
  document
    .querySelectorAll("[data-edit]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        abrir(items.find((x) => String(x.id) === b.dataset.edit)),
      ),
    );
}
function abrir(item = null) {
  editando = item;
  $("#tituloModal").textContent = item ? "Editar usuário" : "Novo usuário";
  $("#usuarioId").value = item?.id || "";
  $("#nome").value = item?.nome || "";
  $("#email").value = item?.email || "";
  $("#perfil").value = item?.perfilId || opcoes.perfis[0]?.id || "";
  $("#departamento").value = item?.departamentoId || "";
  $("#senha").value = "";
  $("#senha").required = !item;
  $("#senhaAjuda").textContent = item
    ? "deixe em branco para manter a senha atual"
    : "obrigatória no cadastro";
  $("#ativo").checked = item ? Boolean(item.ativo) : true;
  $("#erro").hidden = true;
  $("#modal").hidden = false;
  $("#nome").focus();
}
function fechar() {
  $("#modal").hidden = true;
  editando = null;
}
async function salvar(e) {
  e.preventDefault();
  const perfilId = $("#perfil").value,
    perfilNome = $("#perfil option:checked")?.dataset.nome;
  const body = {
    nome: $("#nome").value.trim(),
    email: $("#email").value.trim(),
    perfil: perfilNome,
    departamentoId: $("#departamento").value || null,
    ativo: $("#ativo").checked,
  };
  if ($("#senha").value) body.senha = $("#senha").value;
  const url = editando ? `${API}/${editando.id}` : API;
  try {
    await requisitar(url, {
      method: editando ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    fechar();
    await carregar();
  } catch (e) {
    $("#erro").textContent = e.message;
    $("#erro").hidden = false;
  }
}
$("#novoUsuario").addEventListener("click", () => abrir());
$("#fechar").addEventListener("click", fechar);
$("#cancelar").addEventListener("click", fechar);
$("#formulario").addEventListener("submit", salvar);
$("#atualizar").addEventListener("click", carregar);
$("#filtroPerfil").addEventListener("change", carregar);
$("#filtroAtivo").addEventListener("change", carregar);
let timer;
$("#busca").addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(carregar, 300);
});
window.addEventListener("load", async () => {
  if (!temPermissaoGestao()) {
    location.replace("./dashboard.html");
    return;
  }
  try {
    await carregarOpcoes();
    await carregar();
  } catch (e) {
    if ([401, 403].includes(e.status)) {
      location.replace("./dashboard.html");
      return;
    }
    $("#tabela").innerHTML =
      `<tr><td colspan="7" class="empty">${esc(e.message)}</td></tr>`;
  }
});
