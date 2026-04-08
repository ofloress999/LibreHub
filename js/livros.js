import { db } from './firebase.js';
import { 
    collection, 
    getDocs, 
    deleteDoc, 
    doc, 
    query, 
    where, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS GLOBAIS ---
let todosOsLivros = [];
// AJUSTE: O .trim() remove espaços vazios e o || "" evita erros se estiver nulo
const tipoUsuario = (localStorage.getItem('tipoUsuario') || "").trim(); 

document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema iniciado. Cargo detectado:", tipoUsuario);

    // 1. Inicializa a interface (Mostra/Esconde botões de Admin)
    configurarLayoutPorCargo();
    
    // 2. Carrega os dados do Firebase
    carregarDadosDoFirebase();
    
    // 3. Configura os filtros de busca
    setupFiltros();

    // --- EVENTOS DE INTERAÇÃO ---
    const inputCPF = document.getElementById('inputUsuarioBusca');
    if (inputCPF) {
        inputCPF.addEventListener('input', buscarUsuarioPorCPF);
    }

    const formEmprestimo = document.getElementById('formEmprestimo');
    if (formEmprestimo) {
        formEmprestimo.addEventListener('submit', salvarEmprestimoNoFirebase);
    }
});

// 1. Configura o que aparece na tela baseado no Cargo
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

// 2. Busca os dados no Firebase
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

    // Decide se mostra botão de "Alugar" ou "Devolver"
    const botaoAcao = l.status === 'Disponível' 
        ? `<button class="btn edit" onclick="abrirModalEmprestimo('${id}')">Alugar</button>`
        : `<button class="btn return" style="background-color: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" onclick="devolverLivro('${id}')">Devolver</button>`;

    corpoTabela.innerHTML += `
        <tr>
            <td><img src="${l.capa || '../img/default-book.png'}" style="width:40px; border-radius:4px;"></td>
            <td><strong>${l.titulo || l.nome}</strong></td>
            <td>${l.autor}</td>
            <td>${l.usuarioAluguel || '-'}</td>
            <td><span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</span></td>
            <td>${l.dataDevolucao || '-'}</td>
            <td>
                ${botaoAcao}
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

// --- FUNÇÕES DE LÓGICA DE EMPRÉSTIMO ---

async function buscarUsuarioPorCPF() {
    const cpf = document.getElementById('inputUsuarioBusca').value;
    const painel = document.getElementById('detalhesUsuario');
    const btnConfirmar = document.getElementById('btnConfirmarEmprestimo');

    if (cpf.length < 11) {
        painel.style.display = 'none';
        btnConfirmar.disabled = true;
        return;
    }

    try {
        const q = query(collection(db, "usuarios"), where("cpf", "==", cpf));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const user = querySnapshot.docs[0].data();
            document.getElementById('info-nome').innerText = user.nome;
            document.getElementById('info-email').innerText = user.email;
            
            painel.style.display = 'block';
            btnConfirmar.disabled = false;
        } else {
            painel.style.display = 'none';
            btnConfirmar.disabled = true;
        }
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
    }
}

async function salvarEmprestimoNoFirebase(e) {
    e.preventDefault();
    
    const idLivro = document.getElementById('idLivroModal').value;
    const nomeUsuario = document.getElementById('info-nome').innerText;
    
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 14);
    const dataDevolucao = hoje.toLocaleDateString('pt-BR');

    try {
        const livroRef = doc(db, "livros", idLivro);
        
        await updateDoc(livroRef, {
            status: "Alugado",
            usuarioAluguel: nomeUsuario,
            dataDevolucao: dataDevolucao
        });

        alert("Empréstimo registrado!");
        fecharModalEmprestimo();
        carregarDadosDoFirebase();
        
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao processar.");
    }
}

// --- DEVOLUÇÃO ---

window.devolverLivro = async (id) => {
    if (!confirm("Confirmar a devolução deste livro?")) return;

    try {
        const livroRef = doc(db, "livros", id);
        await updateDoc(livroRef, {
            status: "Disponível",
            usuarioAluguel: "",
            dataDevolucao: ""
        });

        alert("Livro devolvido com sucesso!");
        carregarDadosDoFirebase();
    } catch (error) {
        console.error("Erro ao devolver:", error);
    }
};

// --- MODAIS E UTILITÁRIOS ---

window.abrirModalEmprestimo = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if(!livro) return;

    document.getElementById('idLivroModal').value = id;
    document.getElementById('nomeLivroModal').innerText = "Livro: " + (livro.titulo || livro.nome);
    document.getElementById('modalEmprestimo').style.display = 'flex';
};

window.fecharModalEmprestimo = () => {
    document.getElementById('modalEmprestimo').style.display = 'none';
    document.getElementById('formEmprestimo').reset();
    document.getElementById('detalhesUsuario').style.display = 'none';
};

window.abrirModalDetalhes = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    document.getElementById('detalheCapa').src = livro.capa || '../img/default-book.png';
    document.getElementById('detalheTitulo').innerText = livro.titulo || livro.nome;
    document.getElementById('detalheAutor').innerText = "Autor: " + livro.autor;
    document.getElementById('detalheSinopse').innerText = livro.sinopse || "Sem sinopse disponível.";
    
    const statusEl = document.getElementById('detalheStatus');
    statusEl.innerText = livro.status;
    statusEl.className = livro.status === 'Disponível' ? 'status-livre' : 'status-alugado';

    const btnPDF = document.getElementById('btnBaixarPDF');
    if (livro.pdfUrl) {
        btnPDF.href = livro.pdfUrl;
        btnPDF.style.display = 'flex';
    } else {
        btnPDF.style.display = 'none';
    }

    document.getElementById('modalDetalhesLivro').style.display = 'flex';
};

window.fecharModalDetalhes = () => {
    document.getElementById('modalDetalhesLivro').style.display = 'none';
};

window.excluirLivro = async (id) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
        await deleteDoc(doc(db, "livros", id));
        alert("Livro removido!");
        carregarDadosDoFirebase();
    } catch (error) {
        console.error("Erro ao excluir:", error);
    }
};

function setupFiltros() {
    const busca = document.getElementById('inputBusca');
    const filtro = document.getElementById('filtroStatus');

    const filtrar = () => {
        const termo = busca.value.toLowerCase();
        const statusSel = filtro.value;

        document.querySelectorAll('#tabelaLivrosCorpo tr').forEach(tr => {
            const texto = tr.innerText.toLowerCase();
            const statusText = tr.querySelector('span')?.innerText || "";
            const bateBusca = texto.includes(termo);
            const bateStatus = statusSel === "Todos" || statusText === statusSel;
            tr.style.display = (bateBusca && bateStatus) ? "" : "none";
        });

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