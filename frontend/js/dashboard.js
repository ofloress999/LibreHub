// js/dashboard.js
import { db } from './firebase.js'; 
import { collection, getDocs, query, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function carregarDadosDashboard() {
    try {
        // 1. Busca todos os usuários para o contador
        const usuariosSnapshot = await getDocs(collection(db, "usuarios"));
        document.getElementById("total-usuarios").innerText = usuariosSnapshot.size;

        // 2. Busca todos os livros
        const livrosSnapshot = await getDocs(collection(db, "livros"));
        let total = livrosSnapshot.size;
        let disponiveis = 0;
        let alugados = 0;

        livrosSnapshot.forEach(doc => {
            const dados = doc.data();
            if (dados.status === "disponivel") disponiveis++;
            else if (dados.status === "alugado") alugados++;
        });

        // Atualiza os números na tela
        document.getElementById("num-total-livros").innerText = total;
        document.getElementById("num-disponiveis").innerText = disponiveis;
        document.getElementById("num-alugados").innerText = alugados;

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

// Executa quando a página termina de carregar
window.onload = carregarDadosDashboard;

const usuario = localStorage.getItem('usuarioLogado');

if (!usuario) {
    alert("Você precisa estar logado!");
    window.location.href = "../index.html"; // Volta para o login
}

document.addEventListener('DOMContentLoaded', () => {
    initGlobalFeatures();

    // 1. Identifica se estamos na Dashboard (Home)
    const recentContainer = document.getElementById('recent-books-container');
    if (recentContainer) {
        console.log("Iniciando Dashboard...");
        atualizarDashboardReal();
        // Se houver função de estatísticas, chame-a aqui
        if (typeof atualizarEstatisticasDash === "function") atualizarEstatisticasDash();
    }

    // 2. Identifica se estamos na Listagem de Livros (Tabela)
    const tabelaCorpo = document.getElementById('tabelaLivrosCorpo');
    if (tabelaCorpo) {
        renderizarComoTabela(); 
        setupFiltros();
        
        // Configura a busca de usuário no modal de empréstimo
        const inputBuscaUser = document.getElementById('inputUsuarioBusca');
        if (inputBuscaUser) {
            inputBuscaUser.addEventListener('input', buscarUsuarioPorCPF);
        }
        
        // Configura o envio do formulário de empréstimo
        const formEmprestimo = document.getElementById('formEmprestimo');
        if (formEmprestimo) {
            formEmprestimo.addEventListener('submit', salvarEmprestimo);
        }
    }
});

// --- FUNÇÕES DE RENDERIZAÇÃO ---

function atualizarDashboardReal() {
    const container = document.getElementById('recent-books-container');
    if (!container) return;

    const livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    
    // Pega os 4 mais recentes
    const ultimos = [...livros].reverse().slice(0, 4);
    
    if (ultimos.length === 0) {
        container.innerHTML = "<p>Nenhum livro cadastrado.</p>";
        return;
    }

    container.innerHTML = ultimos.map(l => `
        <div class="book-card" style="opacity:1; transform:none;" onclick="window.location.href='books.html'">
            <img src="${l.capa || '../img/user.png'}" onerror="this.src='../img/user.png'">
            <h4>${l.nome}</h4>
            <p>${l.autor}</p>
            <p class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</p>
        </div>
    `).join('');
}

function renderizarComoTabela() {
    const corpo = document.getElementById('tabelaLivrosCorpo');
    const livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    if (!corpo) return;

    corpo.innerHTML = "";
    livros.forEach(l => {
        corpo.innerHTML += `
            <tr onclick="abrirModalDetalhes(${l.id})" style="cursor:pointer">
                <td><img src="${l.capa}" style="width:40px; border-radius:4px;"></td>
                <td><strong>${l.nome}</strong></td>
                <td>${l.autor}</td>
                <td>${l.usuarioAluguel || '-'}</td>
                <td><span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</span></td>
                <td>${l.dataDevolucao || '-'}</td>
                <td>
                    <button class="btn edit" onclick="event.stopPropagation(); abrirModalEmprestimo(${l.id})">Alugar</button>
                    <button class="btn delete" onclick="event.stopPropagation(); excluirLivro(${l.id})">Excluir</button>
                </td>
            </tr>
        `;
    });
}

// --- MODAIS ---

function abrirModalDetalhes(id) {
    const livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    const livro = livros.find(l => l.id === id);
    if (!livro) return;

    document.getElementById('detalheCapa').src = livro.capa;
    document.getElementById('detalheTitulo').innerText = livro.nome;
    document.getElementById('detalheAutor').innerText = livro.autor;
    document.getElementById('detalheSinopse').innerText = livro.sinopse || "Sem descrição disponível.";
    
    const statusEl = document.getElementById('detalheStatus');
    statusEl.innerText = livro.status;
    statusEl.className = livro.status === 'Disponível' ? 'status-livre' : 'status-alugado';

    const btnPDF = document.getElementById('btnBaixarPDF');
    // Verificação rigorosa do PDF
    if (livro.pdfUrl && livro.pdfUrl.length > 100) { 
        btnPDF.href = livro.pdfUrl;
        btnPDF.style.display = 'flex';
        btnPDF.download = `${livro.nome}.pdf`;
    } else {
        btnPDF.style.display = 'none';
    }

    document.getElementById('modalDetalhesLivro').style.display = 'flex';
}

function fecharModalDetalhes() {
    document.getElementById('modalDetalhesLivro').style.display = 'none';
}

function abrirModalEmprestimo(id) {
    const livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    const livro = livros.find(l => l.id === id);
    if(!livro) return;

    document.getElementById('idLivroModal').value = id;
    document.getElementById('nomeLivroModal').innerText = "Livro: " + livro.nome;
    document.getElementById('modalEmprestimo').style.display = 'flex';
}

function fecharModal() { 
    document.getElementById('modalEmprestimo').style.display = 'none'; 
    document.getElementById('detalhesUsuario').style.display = 'none';
    document.getElementById('formEmprestimo').reset();
}

// --- LÓGICA DE NEGÓCIO ---

function buscarUsuarioPorCPF() {
    const cpf = document.getElementById('inputUsuarioBusca').value;
    const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    const user = usuarios.find(u => u.cpf === cpf);
    const painel = document.getElementById('detalhesUsuario');
    
    if (user) {
        document.getElementById('info-nome').innerText = user.nome;
        document.getElementById('info-email').innerText = user.email;
        painel.style.display = 'block';
        document.getElementById('btnConfirmarEmprestimo').disabled = false;
    } else {
        painel.style.display = 'none';
        document.getElementById('btnConfirmarEmprestimo').disabled = true;
    }
}

function salvarEmprestimo(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('idLivroModal').value);
    const nomeUser = document.getElementById('info-nome').innerText;
    let livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    const idx = livros.findIndex(l => l.id === id);

    if (idx !== -1) {
        livros[idx].status = "Alugado";
        livros[idx].usuarioAluguel = nomeUser;
        livros[idx].dataDevolucao = new Date(Date.now() + 12096e5).toLocaleDateString('pt-BR'); 
        localStorage.setItem('biblioteca_livros', JSON.stringify(livros));
        fecharModal();
        renderizarComoTabela();
    }
}

function excluirLivro(id) {
    if (!confirm("Tem certeza que deseja excluir este livro?")) return;
    let livros = JSON.parse(localStorage.getItem('biblioteca_livros')) || [];
    livros = livros.filter(l => l.id !== id);
    localStorage.setItem('biblioteca_livros', JSON.stringify(livros));
    renderizarComoTabela();
}

function initGlobalFeatures() {
    // Tema
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            const isDark = document.body.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggle.innerText = isDark ? "☀️" : "🌙";
        };
    }
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

    // Sidebar
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.onclick = () => document.getElementById('sidebar').classList.toggle('closed');
    }
    
    // Dropdown Perfil
    const profileBtn = document.getElementById('profileBtn');
    const dropdown = document.getElementById('dropdown');
    if (profileBtn && dropdown) {
        profileBtn.onclick = (e) => { 
            e.stopPropagation(); 
            dropdown.classList.toggle('show'); 
        };
        document.onclick = () => dropdown.classList.remove('show');
    }
}

function setupFiltros() {
    const busca = document.getElementById('inputBusca');
    const filtro = document.getElementById('filtroStatus');
    if (!busca || !filtro) return;

    const filtrar = () => {
        const termo = busca.value.toLowerCase();
        const status = filtro.value;
        const linhas = document.querySelectorAll('#tabelaLivrosCorpo tr');
        
        linhas.forEach(linha => {
            const texto = linha.innerText.toLowerCase();
            const bateBusca = texto.includes(termo);
            const bateStatus = status === "Todos" || texto.includes(status.toLowerCase());
            linha.style.display = (bateBusca && bateStatus) ? "" : "none";
        });
    };

    busca.addEventListener('keyup', filtrar);
    filtro.addEventListener('change', filtrar);
}