"use strict";

const { montarAmbienteFilho } = require("../helpers/server");

describe("Isolamento do servidor de testes", () => {
  test("não herda nem aceita conexão com o banco hospedado", () => {
    const urlOriginal = process.env.DATABASE_URL;

    try {
      process.env.DATABASE_URL = "postgres://remote.example/babycare";
      const ambiente = montarAmbienteFilho({
        DATABASE_URL: "postgres://override.example/babycare",
        DB_HOST: "remote.example",
        DB_NAME: "babycare",
      });

      expect(ambiente.DATABASE_URL).toBe("");
      expect(ambiente.DB_NAME).toBe("babycare_test");
      expect(["localhost", "127.0.0.1", "::1"]).toContain(ambiente.DB_HOST);
    } finally {
      if (urlOriginal === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = urlOriginal;
      }
    }
  });
});
