"use strict";
/**
 * Configuração do Jest para a bateria de testes do Babycare.
 *
 * - testEnvironment: node (não usamos DOM/JSDOM nesta bateria);
 * - runInBand/sequencial: os testes compartilham uma porta única e um banco
 *   único (babycare_test), então a execução é serial para não conflitar;
 * - testTimeout generoso: cada teste pode iniciar o servidor real (até 30s).
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  testTimeout: 60000,
  maxWorkers: 1,
  verbose: true,
};