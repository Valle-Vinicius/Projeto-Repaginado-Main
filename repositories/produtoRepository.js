const db = require('../config/database');

class ProdutoRepository {

    async listarTodos() {
        const [rows] = await db.execute(`
            SELECT
                id,
                codigo,
                nome,
                marca,
                categoria,
                faixa_etaria AS faixaEtaria,
                tamanho,
                quantidade,
                preco_custo AS precoCusto,
                preco_venda AS precoVenda,
                data_entrada AS dataEntrada,
                data_saida AS dataSaida,
                validade,
                observacoes,
                criado_em AS criadoEm,
                atualizado_em AS atualizadoEm
            FROM produtos
            ORDER BY criado_em DESC
        `);

        return rows;
    }

    async buscarPorId(id) {
        const [rows] = await db.execute(`
            SELECT
                id,
                codigo,
                nome,
                marca,
                categoria,
                faixa_etaria AS faixaEtaria,
                tamanho,
                quantidade,
                preco_custo AS precoCusto,
                preco_venda AS precoVenda,
                data_entrada AS dataEntrada,
                data_saida AS dataSaida,
                validade,
                observacoes,
                criado_em AS criadoEm,
                atualizado_em AS atualizadoEm
            FROM produtos
            WHERE id = ?
        `, [id]);

        return rows[0] || null;
    }

    async buscarPorCodigo(codigo) {
        const [rows] = await db.execute(`
            SELECT
                id,
                codigo,
                nome,
                marca,
                categoria,
                faixa_etaria AS faixaEtaria,
                tamanho,
                quantidade,
                preco_custo AS precoCusto,
                preco_venda AS precoVenda,
                data_entrada AS dataEntrada,
                data_saida AS dataSaida,
                validade,
                observacoes
            FROM produtos
            WHERE codigo = ?
        `, [codigo]);

        return rows[0] || null;
    }

    async criar(dados) {
        const [result] = await db.execute(`
            INSERT INTO produtos (
                codigo,
                nome,
                marca,
                categoria,
                faixa_etaria,
                tamanho,
                quantidade,
                preco_custo,
                preco_venda,
                data_entrada,
                validade,
                observacoes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            dados.codigoInterno || dados.codigo,
            dados.nome,
            dados.marca || null,
            dados.categoria || null,
            dados.faixaEtaria || null,
            dados.tamanho || null,
            Number(dados.quantidade) || 0,
            Number(dados.precoCusto) || 0,
            Number(dados.precoVenda) || 0,
            dados.dataEntrada || null,
            dados.validade || null,
            dados.observacoes || null
        ]);

        return result.insertId;
    }

    async atualizar(id, dados) {
        const campos = [];
        const valores = [];

        if (
            dados.codigoInterno !== undefined ||
            dados.codigo !== undefined
        ) {
            campos.push('codigo = ?');
            valores.push(
                dados.codigoInterno !== undefined
                    ? dados.codigoInterno
                    : dados.codigo
            );
        }

        if (dados.nome !== undefined) {
            campos.push('nome = ?');
            valores.push(dados.nome);
        }

        if (dados.marca !== undefined) {
            campos.push('marca = ?');
            valores.push(dados.marca || null);
        }

        if (dados.categoria !== undefined) {
            campos.push('categoria = ?');
            valores.push(dados.categoria || null);
        }

        if (dados.faixaEtaria !== undefined) {
            campos.push('faixa_etaria = ?');
            valores.push(dados.faixaEtaria || null);
        }

        if (dados.tamanho !== undefined) {
            campos.push('tamanho = ?');
            valores.push(dados.tamanho || null);
        }

        if (dados.quantidade !== undefined) {
            campos.push('quantidade = ?');
            valores.push(Number(dados.quantidade) || 0);
        }

        if (dados.precoCusto !== undefined) {
            campos.push('preco_custo = ?');
            valores.push(Number(dados.precoCusto) || 0);
        }

        if (dados.precoVenda !== undefined) {
            campos.push('preco_venda = ?');
            valores.push(Number(dados.precoVenda) || 0);
        }

        if (dados.dataEntrada !== undefined) {
            campos.push('data_entrada = ?');
            valores.push(dados.dataEntrada || null);
        }

        if (dados.dataSaida !== undefined) {
            campos.push('data_saida = ?');
            valores.push(dados.dataSaida || null);
        }

        if (dados.validade !== undefined) {
            campos.push('validade = ?');
            valores.push(dados.validade || null);
        }

        if (dados.observacoes !== undefined) {
            campos.push('observacoes = ?');
            valores.push(dados.observacoes || null);
        }

        if (campos.length === 0) {
            return false;
        }

        valores.push(id);

        const [result] = await db.execute(`
            UPDATE produtos
            SET ${campos.join(', ')}
            WHERE id = ?
        `, valores);

        return result.affectedRows > 0;
    }

    async remover(id) {
        const [result] = await db.execute(`
            DELETE FROM produtos
            WHERE id = ?
        `, [id]);

        return result.affectedRows > 0;
    }
}

module.exports = new ProdutoRepository();