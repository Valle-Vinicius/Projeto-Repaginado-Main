export function formatarData(valor) {
  if (!valor) {
    return '—';
  }
  const texto = String(valor);
  const data = new Date(texto.includes('T') ? texto : `${texto}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data);
}
