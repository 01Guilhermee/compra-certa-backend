// Importa as bibliotecas necessárias
const express = require('express'); // Framework web para Node.js
const axios = require('axios');     // Cliente HTTP para fazer requisições
const cheerio = require('cheerio'); // Biblioteca para parsear e manipular HTML

const app = express();
// Define a porta do servidor. O Render (e outros serviços de hospedagem)
// irá definir a variável de ambiente PORT automaticamente.
const PORT = process.env.PORT || 3000; 

// Habilita o CORS (Cross-Origin Resource Sharing) para permitir requisições
// de outras origens (como a sua página web hospedada em outro lugar).
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Permite acesso de qualquer origem
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next(); // Continua para a próxima middleware/rota
});

// Endpoint principal para buscar produtos
// A rota é '/buscar' e espera um parâmetro de query 'q' (ex: /buscar?q=smart+tv)
app.get('/buscar', async (req, res) => {
    const searchTerm = req.query.q; // Obtém o termo de busca da query string

    // Validação básica: verifica se o termo de busca foi fornecido
    if (!searchTerm) {
        return res.status(400).json({ error: 'O termo de busca (q) é obrigatório.' });
    }

    console.log(`Recebida requisição para buscar: ${searchTerm}`);

    try {
        // Constrói a URL da Amazon Brasil para a busca.
        // encodeURIComponent garante que o termo de busca com espaços ou caracteres especiais seja formatado corretamente para a URL.
        const amazonUrl = `https://www.amazon.com.br/s?k=${encodeURIComponent(searchTerm)}`;
        console.log(`Buscando na Amazon: ${amazonUrl}`);

        // Faz a requisição HTTP GET para a Amazon
        const { data } = await axios.get(amazonUrl, {
            headers: {
                // Adiciona um User-Agent para simular um navegador real.
                // Isso ajuda a evitar bloqueios por parte do site.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // Carrega o HTML da página no Cheerio para facilitar a manipulação (como o jQuery para o HTML do lado do servidor)
        const $ = cheerio.load(data);
        const results = []; // Array para armazenar os produtos encontrados

        // Seleciona os elementos HTML que representam os resultados de pesquisa na Amazon.
        // O seletor 'div.s-result-item[data-component-type="s-search-result"]' é um seletor comum para os itens de produto.
        // ATENÇÃO: Seletores de web scraping podem mudar se o site alvo alterar sua estrutura HTML.
        $('div.s-result-item[data-component-type="s-search-result"]').each((i, element) => {
            if (results.length >= 10) return false; // Limita a coleta a no máximo 10 resultados

            // Encontra os elementos específicos dentro de cada item de produto
            const titleElement = $(element).find('h2 a.a-link-normal span.a-text-normal');
            const priceWholeElement = $(element).find('span.a-price-whole');
            const priceFractionElement = $(element).find('span.a-price-fraction');
            const linkElement = $(element).find('h2 a.a-link-normal');

            // Extrai o texto e atributos dos elementos
            const title = titleElement.text().trim(); // Nome do produto
            const priceWhole = priceWholeElement.text().trim(); // Parte inteira do preço
            const priceFraction = priceFractionElement.text().trim(); // Parte fracionária do preço
            const productLink = linkElement.attr('href'); // Link relativo do produto

            // Verifica se todos os dados essenciais foram encontrados para este produto
            if (title && priceWhole && priceFraction && productLink) {
                // Formata o preço para o padrão "R$ XX,XX"
                const price = `R$ ${priceWhole},${priceFraction}`;
                // Constrói o link completo do produto se for um link relativo
                const fullLink = productLink.startsWith('http') ? productLink : `https://www.amazon.com.br${productLink}`;

                // Adiciona o produto ao array de resultados
                results.push({
                    nome: title,
                    preco: price,
                    link: fullLink,
                    // Adiciona um valor numérico do preço para facilitar a ordenação posterior
                    // Remove vírgulas e converte para float
                    precoNumerico: parseFloat(`${priceWhole}.${priceFraction.replace(',', '')}`)
                });
            }
        });

        // Ordena os resultados pelo preço numérico (do menor para o maior)
        results.sort((a, b) => a.precoNumerico - b.precoNumerico);

        // Retorna os resultados em formato JSON, limitando a 10 itens
        res.json(results.slice(0, 10));
        console.log(`Retornados ${results.length} resultados.`);

    } catch (error) {
        console.error('Erro ao fazer scraping:', error.message);
        // Em caso de erro, retorna um status 500 (Erro Interno do Servidor)
        res.status(500).json({ error: 'Erro ao buscar produtos. Tente novamente mais tarde.' });
    }
});

// Endpoint básico para verificar se o servidor está funcionando
app.get('/', (req, res) => {
    res.send('Backend Compra Certa está online!');
});

// Inicia o servidor na porta definida
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    // Exemplo de como testar a rota de busca
    console.log(`Para testar, acesse: http://localhost:${PORT}/buscar?q=smart+tv`);
});

// Opcional: Keep-alive para manter o serviço ativo em plataformas como Replit/Render Free Tier.
// Isso faz uma requisição para o próprio servidor a cada X minutos para evitar que ele "durma".
// Em serviços como o Render, o "idle timeout" (tempo de inatividade) pode ser diferente.
// Este ping pode ajudar a manter o serviço ativo por mais tempo no nível gratuito.
setInterval(() => {
    axios.get(`http://localhost:${PORT}`)
        .then(() => console.log('Ping de keep-alive enviado.'))
        .catch(err => console.error('Erro no ping de keep-alive:', err.message));
}, 5 * 60 * 1000); // A cada 5 minutos (5 * 60 segundos * 1000 milissegundos)

