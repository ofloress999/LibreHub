import { db } from './firebase-config.js';
import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS GLOBAIS ---
let todosOsLivros = [];
const tipoUsuario = localStorage.getItem('tipoUsuario'); // 'admin' ou 'comum'

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa a interface
    configurarLayoutPorCargo();
    carregarDadosDoFirebase();
    setupFiltros();
});

// 1. Configura o que aparece na tela baseado no Cargo (Admin ou Usuário)
function configurarLayoutPorCargo() {
    const btnAdd = document.querySelector('.btn-add');
    const tabelaAdmin = document.querySelector('.table-container');
    const containerCards = document.getElementById('container-cards-livros');
    const tituloPagina = document.querySelector('.books-top h2');

    if (tipoUsuario === 'admin') {
        if (btnAdd) btnAdd.style.display = 'block';
        if (tabelaAdmin) tabelaAdmin.style.display = 'block';
        if (containerCards) containerCards.style.display = 'none';
        if (tituloPagina) tituloPagina.innerText = "Gerenciamento de Livros (Admin)";
    } else {
        if (btnAdd) btnAdd.style.display = 'none';
        if (tabelaAdmin) tabelaAdmin.style.display = 'none';
        if (containerCards) containerCards.style.display = 'grid';
        if (tituloPagina) tituloPagina.innerText = "Biblioteca de Livros";
    }
}

// 2. Busca os dados no Firebase e decide como renderizar
async function carregarDadosDoFirebase() {
    const corpoTabela = document.getElementById('tabelaLivrosCorpo');
    const containerCards = document.getElementById('container-cards-livros');

    try {
        const querySnapshot = await getDocs(collection(db, "livros"));
        todosOsLivros = [];
        
        if (corpoTabela) corpoTabela.innerHTML = "";
        if (containerCards) containerCards.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const l = docSnap.data();
            const id = docSnap.id;
            todosOsLivros.push({ id, ...l });

            if (tipoUsuario === 'admin') {
                renderizarLinhaTabela(id, l);
            } else {
                renderizarCardUsuario(id, l);
            }
        });
    } catch (error) {
        console.error("Erro ao buscar livros:", error);
    }
}

// 3. Renderização para ADMIN (Tabela)
function renderizarLinhaTabela(id, l) {
    const corpoTabela = document.getElementById('tabelaLivrosCorpo');
    if (!corpoTabela) return;
    
    corpoTabela.innerHTML += `
        <tr>
            <td><img src="${l.capa || '../img/default-book.png'}" style="width:40px; border-radius:4px;"></td>
            <td><strong>${l.titulo || l.nome}</strong></td>
            <td>${l.autor}</td>
            <td>${l.usuarioAluguel || '-'}</td>
            <td><span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</span></td>
            <td>${l.dataDevolucao || '-'}</td>
            <td>
                <button class="btn edit" onclick="abrirModalEmprestimo('${id}')">Alugar</button>
                <button class="btn delete" onclick="excluirLivro('${id}')">Excluir</button>
            </td>
        </tr>
    `;
}

// 4. Renderização para USUÁRIO (Cards)
function renderizarCardUsuario(id, l) {
    const containerCards = document.getElementById('container-cards-livros');
    if (!containerCards) return;

    containerCards.innerHTML += `
        <div class="book-card-v2" onclick="abrirModalDetalhes('${id}')">
            <img src="${l.capa || '../img/default-book.png'}" class="book-cover-v2">
            <div class="book-info-v2">
                <h4>${l.titulo || l.nome}</h4>
                <p class="author-v2">${l.autor}</p>
                <span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">
                    ${l.status}
                </span>
                <button class="btn-detalhes-v2">Ver Detalhes</button>
            </div>
        </div>
    `;
}

// 5. Modal Detalhado (Usado ao clicar no Card)
window.abrirModalDetalhes = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    document.getElementById('detalheCapa').src = livro.capa || '../img/default-book.png';
    document.getElementById('detalheTitulo').innerText = livro.titulo || livro.nome;
    document.getElementById('detalheAutor').innerText = "Autor: " + livro.autor;
    document.getElementById('detalheSinopse').innerText = livro.sinopse || "Sem sinopse disponível.";
    
    // Status no Modal
    const statusEl = document.getElementById('detalheStatus');
    statusEl.innerText = livro.status;
    statusEl.className = livro.status === 'Disponível' ? 'status-livre' : 'status-alugado';

    // Suporte ao PDF (se houver)
    const btnPDF = document.getElementById('btnBaixarPDF');
    if (livro.pdfUrl) {
        btnPDF.href = livro.pdfUrl;
        btnPDF.style.display = 'flex';
    } else {
        btnPDF.style.display = 'none';
    }

    document.getElementById('modalDetalhesLivro').style.display = 'flex';
};

// 6. Excluir Livro (Apenas Admin)
window.excluirLivro = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este livro permanentemente?")) return;
    try {
        await deleteDoc(doc(db, "livros", id));
        alert("Livro removido!");
        carregarDadosDoFirebase();
    } catch (error) {
        console.error("Erro ao excluir:", error);
    }
};

// 7. Filtros (Busca e Status)
function setupFiltros() {
    const busca = document.getElementById('inputBusca');
    const filtro = document.getElementById('filtroStatus');

    const filtrar = () => {
        const termo = busca.value.toLowerCase();
        const statusSel = filtro.value;

        // Filtra Linhas da Tabela
        document.querySelectorAll('#tabelaLivrosCorpo tr').forEach(tr => {
            const texto = tr.innerText.toLowerCase();
            const statusText = tr.querySelector('span')?.innerText || "";
            const bateBusca = texto.includes(termo);
            const bateStatus = statusSel === "Todos" || statusText === statusSel;
            tr.style.display = (bateBusca && bateStatus) ? "" : "none";
        });

        // Filtra Cards
        document.querySelectorAll('.book-card-v2').forEach(card => {
            const texto = card.innerText.toLowerCase();
            const statusText = card.querySelector('span')?.innerText || "";
            const bateBusca = texto.includes(termo);
            const bateStatus = statusSel === "Todos" || statusText === statusSel;
            card.style.display = (bateBusca && bateStatus) ? "flex" : "none";
        });
    };

    if (busca) busca.addEventListener('input', filtrar);
    if (filtro) filtro.addEventListener('change', filtrar);
}

// Fechar Modais
window.fecharModalDetalhes = () => {
    document.getElementById('modalDetalhesLivro').style.display = 'none';
};