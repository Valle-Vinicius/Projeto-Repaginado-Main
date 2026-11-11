import "../../css/responsive-tables.css";

function atualizarTabela(table) {
  const headers = Array.from(table.tHead?.rows[0]?.cells || []);
  table.classList.add("responsive-table");
  table.parentElement?.classList.add("responsive-table-container");

  table.querySelectorAll("tbody tr").forEach((row) => {
    const cells = Array.from(row.cells);
    const emptyRow = cells.some((cell) => cell.colSpan > 1);
    row.classList.toggle("responsive-table-empty", emptyRow);

    if (emptyRow) {
      return;
    }

    cells.forEach((cell, index) => {
      const label = headers[index]?.textContent.trim();
      const text =
        label || (index === cells.length - 1 ? "Ações" : `Campo ${index + 1}`);
      cell.dataset.label = text;

      let labelElement = cell.querySelector(".responsive-table-label");
      if (!labelElement) {
        labelElement = document.createElement("span");
        labelElement.className = "responsive-table-label";
        cell.prepend(labelElement);
      }
      if (labelElement.textContent !== text) {
        labelElement.textContent = text;
      }
    });
  });
}

function atualizarTabelas(element) {
  if (element instanceof HTMLTableElement) {
    atualizarTabela(element);
  } else if (element instanceof Element) {
    const table = element.closest("table");
    if (table) {
      atualizarTabela(table);
    }
    element.querySelectorAll("table").forEach(atualizarTabela);
  }
}

export function configurarTabelasResponsivas() {
  atualizarTabelas(document.body);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach(atualizarTabelas);
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
