import { auth, db } from './firebase.js'; // Importação do auth necessária
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, 
    getDocs, 
    deleteDoc, 
    doc, 
    getDoc, // Importação faltante
    query, 
    where, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS GLOBAIS ---
let todosOsLivros = [];
// Limpeza robusta do cargo para evitar erros de aspas ou espaços
const tipoUsuario = String(localStorage.getItem('tipoUsuario') || "").replace(/["']/g, "").trim().toLowerCase(); 

// --- INICIALIZAÇÃO E AUTENTICAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Usuário autenticado. Cargo:", tipoUsuario);
        
        // 1. Sincronizador de Perfil (Header)
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const profileIcon = document.getElementById('profileBtn');
            if (userData.fotoUrl && profileIcon) {
                profileIcon.src = userData.fotoUrl;
                profileIcon.style.objectFit = "cover";
            }
        }

        // 2. Inicializa a interface baseada no cargo
        configurarLayoutPorCargo();
        
        // 3. Carrega os livros
        carregarDadosDoFirebase();
    } else {
        // Redireciona se não houver usuário logado
        window.location.href = "../index.html";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Configura filtros e eventos de input que não dependem do Firebase
    setupFiltros();

    const inputCPF = document.getElementById('inputUsuarioBusca');
    if (inputCPF) inputCPF.addEventListener('input', buscarUsuarioPorCPF);

    const formEmprestimo = document.getElementById('formEmprestimo');
    if (formEmprestimo) formEmprestimo.addEventListener('submit', salvarEmprestimoNoFirebase);
});

// --- LÓGICA DE INTERFACE ---

function configurarLayoutPorCargo() {
    const btnAdd = document.querySelector('.btn-add'); // Botão de cadastrar livro
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

// --- BUSCA E RENDERIZAÇÃO ---

async function carregarDadosDoFirebase() {
    const corpoTabela = document.getElementById('tabelaLivrosCorpo');
    const containerCards = document.getElementById('container-cards-livros');

    try {
        const querySnapshot = await getDocs(collection(db, "livros"));
        todosOsLivros = [];
        
        if (corpoTabela) corpoTabela.innerHTML = "";
        if (containerCards) containerCards.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;

            // PADRONIZAÇÃO: Garante que o livro tenha título mesmo que cadastrado como 'nome'
            const livro = {
                id: id,
                titulo: data.titulo || data.nome || "Sem título",
                autor: data.autor || "Desconhecido",
                status: data.status || "Disponível",
                capa: data.capa || '../img/default-book.png',
                usuarioAluguel: data.usuarioAluguel || "",
                dataDevolucao: data.dataDevolucao || "",
                pdfUrl: data.pdfUrl || "",
                sinopse: data.sinopse || ""
            };

            todosOsLivros.push(livro);

            if (tipoUsuario === 'admin') {
                renderizarLinhaTabela(id, livro);
            } else {
                renderizarCardUsuario(id, livro);
            }
        });
    } catch (error) {
        console.error("Erro ao buscar livros:", error);
    }
}

function renderizarLinhaTabela(id, l) {
    const corpoTabela = document.getElementById('tabelaLivrosCorpo');
    if (!corpoTabela) return;

    const botaoAcao = l.status === 'Disponível' 
        ? `<button class="btn edit" onclick="abrirModalEmprestimo('${id}')">Alugar</button>`
        : `<button class="btn return" style="background-color: #28a745; color: white;" onclick="devolverLivro('${id}')">Devolver</button>`;

    corpoTabela.innerHTML += `
        <tr>
            <td><img src="${l.capa}" style="width:40px; height:50px; object-fit:cover; border-radius:4px;"></td>
            <td><strong>${l.titulo}</strong></td>
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

function renderizarCardUsuario(id, l) {
    const containerCards = document.getElementById('container-cards-livros');
    if (!containerCards) return;

    containerCards.innerHTML += `
        <div class="book-card-v2" onclick="abrirModalDetalhes('${id}')">
            <img src="${l.capa}" class="book-cover-v2">
            <div class="book-info-v2">
                <h4>${l.titulo}</h4>
                <p class="author-v2">${l.autor}</p>
                <span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">
                    ${l.status}
                </span>
                <button class="btn-detalhes-v2">Ver Detalhes</button>
            </div>
        </div>
    `;
}

// --- LÓGICA DE EMPRÉSTIMO ---

async function buscarUsuarioPorCPF() {
    const cpf = document.getElementById('inputUsuarioBusca').value.trim();
    const painel = document.getElementById('detalhesUsuario');
    const btnConfirmar = document.getElementById('btnConfirmarEmprestimo');

    if (cpf.length < 11) {
        if(painel) painel.style.display = 'none';
        if(btnConfirmar) btnConfirmar.disabled = true;
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
        await updateDoc(doc(db, "livros", idLivro), {
            status: "Alugado",
            usuarioAluguel: nomeUsuario,
            dataDevolucao: dataDevolucao
        });

        alert("Empréstimo registrado!");
        fecharModalEmprestimo();
        carregarDadosDoFirebase();
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao processar empréstimo.");
    }
}

// --- DEVOLUÇÃO E EXCLUSÃO ---

window.devolverLivro = async (id) => {
    if (!confirm("Confirmar a devolução deste livro?")) return;
    try {
        await updateDoc(doc(db, "livros", id), {
            status: "Disponível",
            usuarioAluguel: "",
            dataDevolucao: ""
        });
        alert("Livro devolvido!");
        carregarDadosDoFirebase();
    } catch (error) {
        console.error("Erro ao devolver:", error);
    }
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

// --- MODAIS ---

window.abrirModalEmprestimo = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if(!livro) return;
    document.getElementById('idLivroModal').value = id;
    document.getElementById('nomeLivroModal').innerText = "Livro: " + livro.titulo;
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

    document.getElementById('detalheCapa').src = livro.capa;
    document.getElementById('detalheTitulo').innerText = livro.titulo;
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

// --- FILTROS ---

function setupFiltros() {
    const busca = document.getElementById('inputBusca');
    const filtro = document.getElementById('filtroStatus');

    const filtrar = () => {
        const termo = busca.value.toLowerCase();
        const statusSel = filtro.value;

        // Filtro da Tabela (Admin)
        document.querySelectorAll('#tabelaLivrosCorpo tr').forEach(tr => {
            const texto = tr.innerText.toLowerCase();
            const statusLinha = tr.querySelector('span')?.innerText || "";
            const bateBusca = texto.includes(termo);
            const bateStatus = statusSel === "Todos" || statusLinha === statusSel;
            tr.style.display = (bateBusca && bateStatus) ? "" : "none";
        });

        // Filtro dos Cards (Usuário)
        document.querySelectorAll('.book-card-v2').forEach(card => {
            const texto = card.innerText.toLowerCase();
            const statusCard = card.querySelector('span')?.innerText || "";
            const bateBusca = texto.includes(termo);
            const bateStatus = statusSel === "Todos" || statusCard === statusSel;
            card.style.display = (bateBusca && bateStatus) ? "flex" : "none";
        });
    };

    if (busca) busca.addEventListener('input', filtrar);
    if (filtro) filtro.addEventListener('change', filtrar);
}