function converterPlaceholders(sql) {
  let resultado = '';
  let indice = 1;
  let dentroDeAspasSimples = false;
  let dentroDeAspasDuplas = false;

  for (let i = 0; i < sql.length; i++) {
    const caractere = sql[i];
    const proximo = sql[i + 1];

    if (caractere === "'" && !dentroDeAspasDuplas) {
      if (dentroDeAspasSimples && proximo === "'") {
        resultado += caractere + proximo;
        i++;
        continue;
      }
      dentroDeAspasSimples = !dentroDeAspasSimples;
      resultado += caractere;
      continue;
    }

    if (caractere === '"' && !dentroDeAspasSimples) {
      if (dentroDeAspasDuplas && proximo === '"') {
        resultado += caractere + proximo;
        i++;
        continue;
      }
      dentroDeAspasDuplas = !dentroDeAspasDuplas;
      resultado += caractere;
      continue;
    }

    if (caractere === '?' && !dentroDeAspasSimples && !dentroDeAspasDuplas) {
      resultado += `$${indice++}`;
    } else {
      resultado += caractere;
    }
  }

  return resultado;
}

function normalizarAliases(sql, linhas) {
  const aliases = [...sql.matchAll(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map(([, alias]) => alias);
  if (!aliases.some((alias) => /[A-Z]/.test(alias))) {
    return linhas;
  }

  const nomesOriginais = new Map(aliases.map((alias) => [alias.toLowerCase(), alias]));
  return linhas.map((linha) =>
    Object.fromEntries(
      Object.entries(linha).map(([chave, valor]) => [
        nomesOriginais.get(chave.toLowerCase()) || chave,
        valor,
      ])
    )
  );
}

function prepararSql(sql) {
  return converterPlaceholders(sql);
}

module.exports = { converterPlaceholders, normalizarAliases, prepararSql };