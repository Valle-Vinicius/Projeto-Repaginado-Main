# 👶 Sistema Baby Care
## 📝 Sobre o Projeto
O **Sistema Baby Care** foi desenvolvido com o objetivo de otimizar o controle de estoque e as operações internas de uma empresa especializada em produtos infantis. 

Com o crescimento da empresa e o aumento da demanda, tornou-se essencial adotar uma solução informatizada capaz de:
* **Organizar o estoque** e facilitar a gestão de produtos.
* **Integrar setores** internos com segurança.
* **Garantir eficiência operacional** e confiabilidade nos processos logísticos.

Este projeto representa a aplicação prática dos conceitos de automação e tecnologia aprendidos ao longo do curso técnico, focando na transformação digital de empresas de pequeno porte.

---

## 📁 Estrutura de Pastas
A organização dos arquivos do projeto segue o padrão abaixo para garantir a modularidade e facilitar a manutenção do código:

C:.
│   app.js
│   database.sql
│   docker-compose.yml
│   README.md
│   server.js
│   
├───backend
│   │   .env.example
│   │   app.js
│   │   database.sql
│   │   package-lock.json
│   │   package.json
│   │   server.js
│   │   
│   ├───config
│   │       database.js
│   │       env.js
│   │       
│   ├───controllers
│   │       ajusteController.js
│   │       auditoriaController.js
│   │       authController.js
│   │       categoriaController.js
│   │       dashboardController.js
│   │       estoqueController.js
│   │       expedicaoController.js
│   │       localizacaoController.js
│   │       loteController.js
│   │       movimentacaoController.js
│   │       produtoController.js
│   │       recebimentoController.js
│   │       relatorioController.js
│   │       usuarioController.js
│   │       
│   ├───database
│   │       criarUsuario.js
│   │       
│   ├───errors
│   │       AppError.js
│   │       
│   ├───middlewares
│   │       authMiddleware.js
│   │       errorMiddleware.js
│   │       permissionMiddleware.js
│   │       
│   ├───repositories
│   │       ajusteRepository.js
│   │       auditoriaRepository.js
│   │       categoriaRepository.js
│   │       dashboardRepository.js
│   │       estoqueRepository.js
│   │       expedicaoRepository.js
│   │       localizacaoRepository.js
│   │       loteRepository.js
│   │       movimentacaoRepository.js
│   │       produtoRepository.js
│   │       recebimentoRepository.js
│   │       relatorioRepository.js
│   │       userRepository.js
│   │       usuarioRepository.js
│   │       
│   ├───routes
│   │       ajusteRoutes.js
│   │       auditoriaRoutes.js
│   │       authRoutes.js
│   │       categoriaRoutes.js
│   │       dashboardRoutes.js
│   │       estoqueRoutes.js
│   │       expedicaoRoutes.js
│   │       localizacaoRoutes.js
│   │       loteRoutes.js
│   │       movimentacaoRoutes.js
│   │       produtoRoutes.js
│   │       recebimentoRoutes.js
│   │       relatorioRoutes.js
│   │       usuarioRoutes.js
│   │       
│   ├───services
│   │       ajusteService.js
│   │       auditoriaService.js
│   │       authService.js
│   │       categoriaService.js
│   │       dashboardService.js
│   │       estoqueService.js
│   │       expedicaoService.js
│   │       localizacaoService.js
│   │       loteService.js
│   │       movimentacaoService.js
│   │       produtoService.js
│   │       recebimentoService.js
│   │       relatorioService.js
│   │       usuarioService.js
│   │       
│   └───validators
│           authValidator.js
│           estoqueValidator.js
│           expedicaoValidator.js
│           produtoValidator.js
│           recebimentoValidator.js
│           
├───config
│       database.js
│       env.js
│       
├───controllers
│       ajusteController.js
│       auditoriaController.js
│       authController.js
│       categoriaController.js
│       dashboardController.js
│       estoqueController.js
│       expedicaoController.js
│       localizacaoController.js
│       loteController.js
│       movimentacaoController.js
│       produtoController.js
│       recebimentoController.js
│       relatorioController.js
│       usuarioController.js
│       
├───database
│       criarUsuario.js
│       
├───docs
│       01-visao-e-escopo.md
│       02-requisitos-e-regras.md
│       03-arquitetura-e-dados.md
│       04-api-e-testes.md
│       decisoes.md
│       
├───errors
│       AppError.js
│       
├───frontend
│   │   app.js
│   │   index.html
│   │   
│   ├───images
│   │       babycare-login-background.png
│   │       babycare-logo.png
│   │       
│   ├───js
│   │       api.js
│   │       auditoria.js
│   │       dashboard.js
│   │       estoque.js
│   │       expedicoes.js
│   │       formulario-produto.js
│   │       login.js
│   │       produtos.js
│   │       recebimentos.js
│   │       relatorio.js
│   │       relatorios.js
│   │       ui.js
│   │       
│   ├───pages
│   │       ajustes.html
│   │       auditoria.html
│   │       dashboard.html
│   │       erro404.html
│   │       estoque.html
│   │       expedicoes.html
│   │       formulario-produto.html
│   │       login.html
│   │       produtos.html
│   │       recebimentos.html
│   │       relatorios.html
│   │       usuarios.html
│   │       validade.html
│   │       
│   └───styles
│           app.css
│           auditoria.css
│           components.css
│           dashboard.css
│           erro404.css
│           estoque.css
│           expedicoes.css
│           formulario-produto.css
│           global.css
│           layout.css
│           login.css
│           produtos.css
│           recebimentos.css
│           relatorio.css
│           relatorios.css
│           reset.css
│           variables.css
│           
├───images
│       babycare-login-background.png
│       babycare-logo.png
│       
├───js
│       api.js
│       dashboard.js
│       estoque.js
│       expedicoes.js
│       formulario-produto.js
│       login.js
│       produtos.js
│       recebimentos.js
│       ui.js
│       
├───middlewares
│       authMiddleware.js
│       errorMiddleware.js
│       permissionMiddleware.js
│       
├───pages
│       ajustes.html
│       auditoria.html
│       dashboard.html
│       erro404.html
│       estoque.html
│       expedicoes.html
│       formulario-produto.html
│       login.html
│       produtos.html
│       recebimentos.html
│       relatorios.html
│       usuarios.html
│       validade.html
│       
├───public
│   ├───css
│   │       auth.css
│   │       base.css
│   │       dashboard.css
│   │       style.css
│   │       
│   ├───js
│   │       api.js
│   │       cadastro.js
│   │       dashboard.js
│   │       login.js
│   │       produto.js
│   │       
│   └───pages
│           cadastro.html
│           cadastroProduto.html
│           dashboard.html
│           login.html
│           
├───repositories
│       ajusteRepository.js
│       auditoriaRepository.js
│       categoriaRepository.js
│       dashboardRepository.js
│       estoqueRepository.js
│       expedicaoRepository.js
│       localizacaoRepository.js
│       loteRepository.js
│       movimentacaoRepository.js
│       produtoRepository.js
│       recebimentoRepository.js
│       relatorioRepository.js
│       userRepository.js
│       usuarioRepository.js
│       
├───routes
│       ajusteRoutes.js
│       auditoriaRoutes.js
│       authRoutes.js
│       categoriaRoutes.js
│       dashboardRoutes.js
│       estoqueRoutes.js
│       expedicaoRoutes.js
│       index.js
│       localizacaoRoutes.js
│       loteRoutes.js
│       movimentacaoRoutes.js
│       produtoRoutes.js
│       recebimentoRoutes.js
│       relatorioRoutes.js
│       usuarioRoutes.js
│       
├───services
│       ajusteService.js
│       auditoriaService.js
│       authService.js
│       categoriaService.js
│       dashboardService.js
│       estoqueService.js
│       expedicaoService.js
│       fifoService.js
│       localizacaoService.js
│       loteService.js
│       movimentacaoService.js
│       produtoService.js
│       recebimentoService.js
│       relatorioService.js
│       usuarioService.js
│       validadeService.js
│       
├───tests
│   ├───e2e
│   │       .gitkeep
│   │       
│   ├───integration
│   │       .gitkeep
│   │       
│   └───unit
│           .gitkeep
│           
└───validators
        authValidator.js
        estoqueValidator.js
        expedicaoValidator.js
        produtoValidator.js
        recebimentoValidator.js

## 📋 Gestão e Organização (Trello)
Para o planejamento e execução das tarefas, utilizamos o **Trello**. Recentemente, o fluxo de trabalho passou por atualizações importantes:
* **Evolução do Design:** Nova estruturação visual e organização das páginas.
* **Progresso Avançado:** Atualmente, contamos com mais páginas desenvolvidas e estruturadas em comparação ao ano anterior.
* **Facilidade de Acompanhamento:** O quadro foi otimizado para ser visualmente agradável, facilitando a divisão de tarefas e o alinhamento da equipe.

*Nota: O projeto segue em desenvolvimento, com ajustes e melhorias contínuas sendo implementados.*

---

## 🚀 Tecnologias e Ferramentas
* **Gerenciamento de Projeto:** [Trello]https://trello.com/invite/b/68c2fce8418d1f3f15a0798e/ATTI50835d07e69a98e62777c52eb5376bd1D1936EE7/quadro-babycare
* **Tecnologias:** HTML, CSS, JavaScript, frontend, MySQL, etc.

---

## 🎯 Conclusão e Impacto
O desenvolvimento do Baby Care provou como a automação pode transformar a gestão de negócios. O projeto reforçou a importância da **segurança das informações**, da **integração entre setores** e da **experiência do usuário (UX)**, focando em usabilidade e eficiência. 

A implementação deste sistema trará melhorias significativas na velocidade dos processos e na confiabilidade dos dados, preparando a Baby Care para o mercado digital e para um crescimento sustentável.

---

## 👥 Equipe
* **Ana Júlia Ribeiro Ferreira**
* **Anthero Franco**
* **Milena Hoppe Sales**
* **Vinícius Valle Rodrigues**

