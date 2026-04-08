import { auth, db } from './firebase.js'; 
import { 
    collection, getDocs, deleteDoc, doc, query, where, updateDoc, addDoc, limit, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- VARIÁVEIS GLOBAIS ---
let todosOsLivros = [];
const tipoUsuario = (localStorage.getItem('tipoUsuario') || "").trim();

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // Verificação de Autenticação e Persistência da Foto
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. Busca os dados do usuário logado
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            
            if (userDoc.exists()) {
                const dados = userDoc.data();
                const profileBtn = document.getElementById('profileBtn');

                // 2. Se ele tiver uma foto salva no banco, aplica no Header
                if (dados.fotoUrl && profileBtn) {
                    profileBtn.src = dados.fotoUrl;
                    profileBtn.style.objectFit = "cover"; // Garante que não estique
                }
            }
        } else {
            // Se não estiver logado e não estiver na index, redireciona
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = "../index.html";
            }
        }
    });

    initGlobalFeatures();
    // ... resto do seu código
});

// --- MODIFICAÇÃO NA FUNÇÃO DE CARACTERÍSTICAS GLOBAIS ---

function initGlobalFeatures() {
    // Lógica do Tema (Dark/Light)
    const temaSalvo = localStorage.getItem('theme');
    const themeToggle = document.getElementById('theme-toggle');
    
    if (temaSalvo === 'dark') document.body.classList.add('dark');
    if (themeToggle) {
        themeToggle.innerText = temaSalvo === 'dark' ? '☀️' : '🌙';
        themeToggle.onclick = () => {
            const isDark = document.body.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggle.innerText = isDark ? '☀️' : '🌙';
        };
    }

    // Dropdown do Perfil
    const profileBtn = document.getElementById('profileBtn');
    const dropdown = document.getElementById('dropdown');
    if (profileBtn && dropdown) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        };
    }

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', () => {
        if (dropdown) dropdown.classList.remove('show');
    });
}

// ... as outras funções (carregarDadosDoFirebase, etc) continuam iguais ...

// --- CARREGAMENTO DE DADOS ---

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
            todosOsLivros.push({ id, ...data });

            tipoUsuario === 'admin' ? renderizarLinhaTabela(id, data) : renderizarCardUsuario(id, data);
        });
    } catch (error) { console.error("Erro:", error); }
}

// --- RENDERIZAÇÃO ---

function renderizarLinhaTabela(id, l) {
    const corpo = document.getElementById('tabelaLivrosCorpo');
    const btnAcao = l.status === 'Disponível' 
        ? `<button class="btn edit" onclick="abrirModalEmprestimo('${id}')">Alugar</button>`
        : `<button class="btn return" style="background:#28a745;color:white" onclick="devolverLivro('${id}')">Devolver</button>`;

    corpo.innerHTML += `
        <tr>
            <td><img src="${l.capa || '../img/default-book.png'}" style="width:40px;border-radius:4px"></td>
            <td><strong>${l.titulo || l.nome}</strong></td>
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
    container.innerHTML += `
        <div class="book-card-v2" onclick="abrirModalDetalhes('${id}')">
            <img src="${l.capa || '../img/default-book.png'}">
            <div class="book-info-v2">
                <h4>${l.titulo || l.nome}</h4>
                <p>${l.autor}</p>
                <span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</span>
            </div>
        </div>`;
}

// --- LÓGICA DE EMPRÉSTIMO (MODAL) ---

function configurarEventosModais() {
    const inputCPF = document.getElementById('inputUsuarioBusca');
    if (inputCPF) inputCPF.addEventListener('input', buscarUsuarioPorCPF);

    const formEmp = document.getElementById('formEmprestimo');
    if (formEmp) formEmp.addEventListener('submit', confirmarAluguel);
}

async function buscarUsuarioPorCPF() {
    const cpfBusca = document.getElementById('inputUsuarioBusca').value.trim();
    const painel = document.getElementById('detalhesUsuario');
    const btnConfirmar = document.getElementById('btnConfirmarEmprestimo');

    if (cpfBusca.length < 11) {
        painel.style.display = 'none';
        btnConfirmar.disabled = true;
        return;
    }

    try {
        // Busca usuário na coleção "usuarios" do Firebase por CPF
        const q = query(collection(db, "usuarios"), where("cpf", "==", cpfBusca));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const u = snap.docs[0].data();
            document.getElementById('info-nome').innerText = u.nome;
            document.getElementById('info-email').innerText = u.email;
            document.getElementById('info-matricula').innerText = u.matricula || "-";
            painel.style.display = 'block';
            btnConfirmar.disabled = false;
        } else {
            painel.style.display = 'none';
            btnConfirmar.disabled = true;
        }
    } catch (e) { console.error(e); }
}

async function confirmarAluguel(e) {
    e.preventDefault();
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
    document.getElementById('idLivroModal').value = id;
    document.getElementById('nomeLivroModal').innerText = "Livro: " + (l.titulo || l.nome);
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

    document.getElementById('detalheCapa').src = l.capa || '../img/default-book.png';
    document.getElementById('detalheTitulo').innerText = l.titulo || l.nome;
    document.getElementById('detalheAutor').innerText = l.autor;
    document.getElementById('detalheSinopse').innerText = l.sinopse || "Sem descrição.";
    
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
    await updateDoc(doc(db, "livros", id), {
        status: "Disponível", usuarioAluguel: "", dataDevolucao: ""
    });
    carregarDadosDoFirebase();
};

window.excluirLivro = async (id) => {
    if (!confirm("Excluir livro permanentemente?")) return;
    await deleteDoc(doc(db, "livros", id));
    carregarDadosDoFirebase();
};

// --- UTILITÁRIOS ---

function configurarLayoutPorCargo() {
    const areaAdmin = document.getElementById('area-admin-tabela');
    const containerCards = document.getElementById('container-cards-livros');
    const btnAdd = document.getElementById('btn-admin-add');

    if (tipoUsuario === 'admin') {
        if(areaAdmin) areaAdmin.style.display = 'block';
        if(containerCards) containerCards.style.display = 'none';
        if(btnAdd) btnAdd.style.display = 'block';
    } else {
        if(areaAdmin) areaAdmin.style.display = 'none';
        if(containerCards) containerCards.style.display = 'grid';
        if(btnAdd) btnAdd.style.display = 'none';
    }
}

function initGlobalFeatures() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            const isDark = document.body.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        };
    }
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('dropdown').classList.toggle('show');
        };
    }
    document.onclick = () => document.getElementById('dropdown')?.classList.remove('show');
}

function setupFiltros() {
    const busca = document.getElementById('inputBusca');
    const filtroStatus = document.getElementById('filtroStatus');

    const aplicarFiltro = () => {
        const termo = busca.value.toLowerCase();
        const status = filtroStatus.value;

        document.querySelectorAll('tr, .book-card-v2').forEach(el => {
            const texto = el.innerText.toLowerCase();
            const bateBusca = texto.includes(termo);
            const bateStatus = status === "Todos" || texto.includes(status.toLowerCase());
            el.style.display = (bateBusca && bateStatus) ? "" : "none";
        });
    };

    busca?.addEventListener('input', aplicarFiltro);
    filtroStatus?.addEventListener('change', aplicarFiltro);
}