"use strict";

jest.mock("../../backend/services/authService", () => ({
  login: jest.fn(),
}));

const authService = require("../../backend/services/authService");
const nodeEnvOriginal = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
const authController = require("../../backend/controllers/authController");
if (nodeEnvOriginal === undefined) {
  delete process.env.NODE_ENV;
} else {
  process.env.NODE_ENV = nodeEnvOriginal;
}

describe("Cookie de autenticação em produção", () => {
  beforeEach(() => {
    authService.login.mockReset().mockResolvedValue({
      token: "token-de-teste",
      usuario: { id: 1 },
    });
  });

  test("login permite cookie seguro cross-site", async () => {
    const resposta = {
      cookie: jest.fn(),
      json: jest.fn(),
    };

    await authController.login(
      { body: {}, ip: "127.0.0.1", get: () => "teste" },
      resposta,
    );

    expect(resposta.cookie).toHaveBeenCalledWith(
      "babycareToken",
      "token-de-teste",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "none",
      }),
    );
  });

  test("logout limpa cookie com as mesmas opções de produção", () => {
    const resposta = {
      clearCookie: jest.fn(),
      json: jest.fn(),
    };

    authController.logout({}, resposta);

    expect(resposta.clearCookie).toHaveBeenCalledWith(
      "babycareToken",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      }),
    );
  });
});
