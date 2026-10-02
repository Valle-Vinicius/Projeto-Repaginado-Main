const service = require('../services/usuarioService');
function responderErro(res, erro) { console.error('[Usuários]', { mensagem: erro.message, codigo: erro.codigo }); return res.status(erro.statusCode || 500).json({ sucesso: false, codigo: erro.codigo || 'ERRO_USUARIOS', mensagem: erro.statusCode ? erro.message : 'Não foi possível concluir a operação de usuários.' }); }
async function listar(req, res) { try { return res.json({ sucesso: true, usuarios: await service.obterLista({ busca: req.query.busca, perfilId: req.query.perfilId, ativo: req.query.ativo }) }); } catch (e) { return responderErro(res, e); } }
async function opcoes(req, res) { try { return res.json({ sucesso: true, ...await service.obterOpcoes() }); } catch (e) { return responderErro(res, e); } }
async function criar(req, res) { try { return res.status(201).json({ sucesso: true, usuario: await service.criar(req.body || {}, req.usuario) }); } catch (e) { return responderErro(res, e); } }
async function atualizar(req, res) { try { return res.json({ sucesso: true, usuario: await service.atualizar(req.params.id, req.body || {}, req.usuario) }); } catch (e) { return responderErro(res, e); } }
async function inativar(req, res) { try { return res.json({ sucesso: true, usuario: await service.inativar(req.params.id, req.usuario) }); } catch (e) { return responderErro(res, e); } }
module.exports = { listar, opcoes, criar, atualizar, inativar };
