const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Todas as rotas de autenticação começam com /api/auth
app.use('/api/auth', authRoutes);

// Demais rotas da API começam com /api
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'pages', 'login.html')
    );
});

app.use('/api', (req, res) => {
    res.status(404).json({
        mensagem: `Rota não encontrada: ${req.method} ${req.originalUrl}`
    });
});

module.exports = app;