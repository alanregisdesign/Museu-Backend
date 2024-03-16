const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Conexão com o banco de dados MySQL
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Akvokajoleo3008',
    database: 'registro_visitantes_db'
});

// Verificar a conexão com o banco de dados
db.getConnection((err) => {
    if (err) throw err;
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

app.post('/visitante', async (req, res) => {
    const { cpf, nome, profissao, idade, cidade, bairro, senha, genero } = req.body;
    const hashedPassword = await bcrypt.hash(senha, 10);

    db.query('INSERT INTO visitantes (cpf, nome, profissao, idade, cidade, bairro, senha, genero) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [cpf, nome, profissao, idade, cidade, bairro, hashedPassword, genero], (err, results) => {
            if (err) {
                return res.status(500).send('Erro ao cadastrar o visitante');
            }
            res.status(200).send('Cadastro concluido. Aproveite sua visita!');
        });
});

app.post('/login', (req, res) => {
    const { cpf, senha } = req.body;

    db.query('SELECT * FROM visitantes WHERE cpf = ?', [cpf], async (err, results) => {
        if (err) {
            return res.status(500).send('Erro ao tentar login');
        }
        if (results.length > 0) {
            const comparacao = await bcrypt.compare(senha, results[0].senha);
            if (comparacao) {
                const token = jwt.sign({ id: results[0].id }, 'chave_secreta_jwt', { expiresIn: '8h' });
                res.json({ auth: true, token: token });
            } else {
                res.status(401).send('CPF ou senha incorretos');
            }
        } else {
            res.status(404).send('Usuário não encontrado');
        }
    });
});

// Endpoint para total de visitas por dia ou mês
app.get('/visitas/:intervalo', (req, res) => {
    const intervalo = req.params.intervalo;
    let sqlQuery = "";

    if (intervalo === "mês") {
        sqlQuery = `SELECT MONTH(data_cadastro) AS mes, COUNT(*) AS total FROM visitantes GROUP BY MONTH(data_cadastro) ORDER BY mes`;
    } else { // dia
        sqlQuery = `SELECT DATE(data_cadastro) AS dia, COUNT(*) AS total FROM visitantes WHERE data_cadastro > (NOW() - INTERVAL 30 DAY) GROUP BY dia ORDER BY dia`;
    }

    db.query(sqlQuery, (err, results) => {
        if (err) return res.status(500).send('Erro ao buscar dados de visitas');
        res.json(results);
    });
});


app.get('/visitantes-por-cidade', (req, res) => {
    db.query(`SELECT cidade, COUNT(*) AS total FROM visitantes GROUP BY cidade`, (err, results) => {
        if (err) return res.status(500).send('Erro ao buscar visitantes por cidade');
        res.json(results);
    });
});


app.get('/visitas-por-bairro/:bairro/:intervalo', async (req, res) => {
    const { bairro, intervalo } = req.params;
    let sqlQuery = '';

    if (intervalo === 'dia') {
        // Supondo que `data_cadastro` seja a data de visita e está armazenada em formato DATE ou DATETIME
        sqlQuery = `
            SELECT DATE(data_cadastro) AS data, COUNT(*) AS total
            FROM visitantes
            WHERE bairro = ? AND data_cadastro >= CURDATE() - INTERVAL 30 DAY
            GROUP BY DATE(data_cadastro)
            ORDER BY DATE(data_cadastro);
        `;
    } else if (intervalo === 'mês') {
        // Ajuste para agrupar e contar visitas por mês
        sqlQuery = `
            SELECT MONTH(data_cadastro) AS mes, COUNT(*) AS total
            FROM visitantes
            WHERE bairro = ? AND YEAR(data_cadastro) = YEAR(CURDATE())
            GROUP BY MONTH(data_cadastro)
            ORDER BY MONTH(data_cadastro);
        `;
    }

    // Executa a query no banco de dados
    try {
        const [results] = await db.promise().query(sqlQuery, [bairro]);
        res.json(results);
    } catch (error) {
        console.error('Erro ao buscar visitas por bairro:', error);
        res.status(500).send('Erro interno do servidor');
    }
});



app.get('/visitantes-por-genero', (req, res) => {
    db.query(`SELECT genero, COUNT(*) AS total FROM visitantes GROUP BY genero`, (err, results) => {
        if (err) return res.status(500).send('Erro ao buscar visitantes por gênero');
        res.json(results);
    });
});

app.get('/bairros', (req, res) => {
    const sqlQuery = `SELECT DISTINCT bairro FROM visitantes ORDER BY bairro`;
    db.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('Erro ao buscar bairros:', err);
            return res.status(500).send('Erro ao buscar bairros');
        }
        res.json(results.map(row => row.bairro));
    });
});




