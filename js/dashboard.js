import { auth, db } from './firebase.js'; 
import { 
    collection, getDocs, deleteDoc, doc, query, where, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- VARIÁVEIS GLOBAIS ---
let todosOsLivros = [];
// Limpeza robusta do cargo para evitar falhas de comparação
const tipoUsuario = String(localStorage.getItem('tipoUsuario') || "").replace(/["']/g, "").trim().toLowerCase();

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. Persistência da Foto de Perfil
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const dados = userDoc.data();
                const profileBtn = document.getElementById('profileBtn');
                if (dados.fotoUrl && profileBtn) {
                    profileBtn.src = dados.fotoUrl;
                    profileBtn.style.objectFit = "cover";
                    profileBtn.style.borderRadius = "50%";
                }
            }

            // 2. Configura Layout e busca dados
            configurarLayoutPorCargo();
            carregarDadosDoFirebase();
            configurarEventosModais();
            setupFiltros();
        } else {
            window.location.href = "../index.html";
        }
    });

    initGlobalFeatures();
});

// --- FUNÇÕES DE INTERFACE ---

function initGlobalFeatures() {
    // Lógica do Tema
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            const isDark = document.body.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        };
    }
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

    // Dropdown Perfil
    const profileBtn = document.getElementById('profileBtn');
    const dropdown = document.getElementById('dropdown');
    if (profileBtn && dropdown) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        };
    }
    document.addEventListener('click', () => dropdown?.classList.remove('show'));
}

function configurarLayoutPorCargo() {
    const btnAdd = document.getElementById('btn-admin-add'); 
    const areaAdmin = document.getElementById('area-admin-tabela');
    const containerCards = document.getElementById('container-cards-livros');

    console.log("Configurando Layout para:", tipoUsuario);

    if (tipoUsuario === "admin") {
        if (btnAdd) btnAdd.style.setProperty('display', 'block', 'important');
        if (areaAdmin) areaAdmin.style.display = 'block';
        if (containerCards) containerCards.style.display = 'none';
    } else {
        if (btnAdd) btnAdd.style.display = 'none';
        if (areaAdmin) areaAdmin.style.display = 'none';
        if (containerCards) containerCards.style.display = 'grid';
    }
}

// --- CARREGAMENTO DE DADOS (FIREBASE) ---

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

            // Padronização dos dados para evitar que campos vazios quebrem a lista
            const livro = {
                id,
                titulo: data.titulo || data.nome || "Sem título",
                autor: data.autor || "Desconhecido",
                capa: data.capa || '../img/default-book.png',
                status: data.status || "Disponível",
                sinopse: data.sinopse || "",
                pdfUrl: data.pdfUrl || null
            };

            todosOsLivros.push(livro);

            if (tipoUsuario === 'admin') {
                renderizarLinhaTabela(id, livro);
            } else {
                renderizarCardUsuario(id, livro);
            }
        });
    } catch (error) { 
        console.error("Erro ao carregar livros:", error); 
    }
}

function renderizarLinhaTabela(id, l) {
    const corpo = document.getElementById('tabelaLivrosCorpo');
    if (!corpo) return;

    const btnAcao = l.status === 'Disponível' 
        ? `<button class="btn edit" onclick="abrirModalEmprestimo('${id}')">Alugar</button>`
        : `<button class="btn return" style="background:#28a745;color:white" onclick="devolverLivro('${id}')">Devolver</button>`;

    corpo.innerHTML += `
        <tr>
            <td><img src="${l.capa}" style="width:40px;height:50px;object-fit:cover;border-radius:4px"></td>
            <td><strong>${l.titulo}</strong></td>
            <td>${l.autor}</td>
            <td><span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</span></td>
            <td>
                ${btnAcao}
                <button class="btn delete" onclick="excluirLivro('${id}')">Excluir</button>
            </td>
        </tr>`;
}

function renderizarCardUsuario(id, l) {
    const container = document.getElementById('container-cards-livros');
    if (!container) return;

    container.innerHTML += `
        <div class="book-card-v2" onclick="abrirModalDetalhes('${id}')">
            <img src="${l.capa}" style="width:100%; height:200px; object-fit:cover;">
            <div class="book-info-v2">
                <h4>${l.titulo}</h4>
                <p>${l.autor}</p>
                <span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</span>
            </div>
        </div>`;
}

// --- LÓGICA DE EMPRÉSTIMO ---

function configurarEventosModais() {
    const inputCPF = document.getElementById('inputUsuarioBusca');
    if (inputCPF) inputCPF.addEventListener('input', buscarUsuarioPorCPF);

    const formEmp = document.getElementById('formEmprestimo');
    if (formEmp) {
        formEmp.onsubmit = async (e) => {
            e.preventDefault();
            await confirmarAluguel();
        };
    }
}

async function buscarUsuarioPorCPF() {
    const cpfBusca = document.getElementById('inputUsuarioBusca').value.trim();
    const painel = document.getElementById('detalhesUsuario');
    const btnConfirmar = document.getElementById('btnConfirmarEmprestimo');

    if (cpfBusca.length < 11) {
        if(painel) painel.style.display = 'none';
        return;
    }

    try {
        const q = query(collection(db, "usuarios"), where("cpf", "==", cpfBusca));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const u = snap.docs[0].data();
            document.getElementById('info-nome').innerText = u.nome;
            document.getElementById('info-email').innerText = u.email;
            if(painel) painel.style.display = 'block';
            if(btnConfirmar) btnConfirmar.disabled = false;
        } else {
            if(painel) painel.style.display = 'none';
        }
    } catch (e) { console.error(e); }
}

async function confirmarAluguel() {
    const idLivro = document.getElementById('idLivroModal').value;
    const nomeUser = document.getElementById('info-nome').innerText;
    const dataDev = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR');

    try {
        await updateDoc(doc(db, "livros", idLivro), {
            status: "Alugado",
            usuarioAluguel: nomeUser,
            dataDevolucao: dataDev
        });
        alert("Empréstimo realizado!");
        fecharModal();
        carregarDadosDoFirebase();
    } catch (e) { alert("Erro ao alugar."); }
}

// --- FUNÇÕES GLOBAIS (WINDOW) ---

window.abrirModalEmprestimo = (id) => {
    const l = todosOsLivros.find(b => b.id === id);
    if(!l) return;
    document.getElementById('idLivroModal').value = id;
    document.getElementById('nomeLivroModal').innerText = "Livro: " + l.titulo;
    document.getElementById('modalEmprestimo').style.display = 'flex';
};

window.fecharModal = () => {
    document.getElementById('modalEmprestimo').style.display = 'none';
    document.getElementById('formEmprestimo').reset();
    document.getElementById('detalhesUsuario').style.display = 'none';
};

window.abrirModalDetalhes = (id) => {
    const l = todosOsLivros.find(b => b.id === id);
    if (!l) return;

    document.getElementById('detalheCapa').src = l.capa;
    document.getElementById('detalheTitulo').innerText = l.titulo;
    document.getElementById('detalheAutor').innerText = l.autor;
    document.getElementById('detalheSinopse').innerText = l.sinopse;
    
    const statusEl = document.getElementById('detalheStatus');
    statusEl.innerText = l.status;
    statusEl.className = l.status === 'Disponível' ? 'status-livre' : 'status-alugado';

    const btnPDF = document.getElementById('btnBaixarPDF');
    if (l.pdfUrl) {
        btnPDF.href = l.pdfUrl;
        btnPDF.style.display = 'flex';
    } else {
        btnPDF.style.display = 'none';
    }

    document.getElementById('modalDetalhesLivro').style.display = 'flex';
};

window.fecharModalDetalhes = () => {
    document.getElementById('modalDetalhesLivro').style.display = 'none';
};

window.devolverLivro = async (id) => {
    if (!confirm("Confirmar devolução?")) return;
    try {
        await updateDoc(doc(db, "livros", id), {
            status: "Disponível", usuarioAluguel: "", dataDevolucao: ""
        });
        carregarDadosDoFirebase();
    } catch (e) { console.error(e); }
};

window.excluirLivro = async (id) => {
    if (!confirm("Excluir livro permanentemente?")) return;
    try {
        await deleteDoc(doc(db, "livros", id));
        carregarDadosDoFirebase();
    } catch (e) { console.error(e); }
};

function setupFiltros() {
    const busca = document.getElementById('inputBusca');
    const filtroStatus = document.getElementById('filtroStatus');

    const aplicarFiltro = () => {
        const termo = busca.value.toLowerCase();
        const status = filtroStatus.value;

        // Filtro para tabela
        document.querySelectorAll('#tabelaLivrosCorpo tr').forEach(tr => {
            const texto = tr.innerText.toLowerCase();
            const bateBusca = texto.includes(termo);
            const bateStatus = status === "Todos" || texto.includes(status.toLowerCase());
            tr.style.display = (bateBusca && bateStatus) ? "" : "none";
        });

        // Filtro para cards
        document.querySelectorAll('.book-card-v2').forEach(card => {
            const texto = card.innerText.toLowerCase();
            const bateBusca = texto.includes(termo);
            const bateStatus = status === "Todos" || texto.includes(status.toLowerCase());
            card.style.display = (bateBusca && bateStatus) ? "flex" : "none";
        });
    };

    busca?.addEventListener('input', aplicarFiltro);
    filtroStatus?.addEventListener('change', aplicarFiltro);
}