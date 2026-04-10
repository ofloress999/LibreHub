import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, 
    getDocs, 
    deleteDoc, 
    doc, 
    getDoc, 
    query, 
    where, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS GLOBAIS ---
let todosOsLivros = [];
// Lê o cargo inicial, mas o onAuthStateChanged atualizará se necessário
let tipoUsuario = String(localStorage.getItem('tipoUsuario') || "").replace(/["']/g, "").trim().toLowerCase(); 

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();

                const profileIcon = document.getElementById('profileBtn');
                if (userData.fotoUrl && profileIcon) {
                    profileIcon.src = userData.fotoUrl;
                }

                const cargoNoBanco = userData.role || "usuario"; 
                localStorage.setItem('tipoUsuario', cargoNoBanco);
                tipoUsuario = cargoNoBanco.toLowerCase();

                configurarLayoutPorCargo();
                carregarDadosDoFirebase();
            }
        } catch (error) {
            console.error("Erro na autenticação:", error);
        }
    } else {
        window.location.href = "../index.html";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setupFiltros();
    const inputCPF = document.getElementById('inputUsuarioBusca');
    if (inputCPF) inputCPF.addEventListener('input', buscarUsuarioPorCPF);

    const formEmprestimo = document.getElementById('formEmprestimo');
    if (formEmprestimo) formEmprestimo.addEventListener('submit', salvarEmprestimoNoFirebase);
});

// --- LÓGICA DE INTERFACE ---
function configurarLayoutPorCargo() {
    const cargoAtual = localStorage.getItem('tipoUsuario');
    const btnAdd = document.getElementById('btn-admin-add');
    const tabelaAdmin = document.getElementById('area-admin-tabela');
    const containerCards = document.getElementById('container-cards-livros');

    if (cargoAtual === 'admin') {
        if (btnAdd) btnAdd.style.display = 'block';
        if (tabelaAdmin) tabelaAdmin.style.display = 'block';
        if (containerCards) containerCards.style.display = 'none';
    } else {
        if (btnAdd) btnAdd.style.display = 'none';
        if (tabelaAdmin) tabelaAdmin.style.display = 'none';
        if (containerCards) containerCards.style.display = 'grid';
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
            const livro = {
                id: docSnap.id,
                titulo: data.titulo || data.nome || "Sem título",
                autor: data.autor || "Desconhecido",
                status: data.status || "Disponível",
                capa: data.capa || '../img/default-book.png',
                usuarioAluguel: data.usuarioAluguel || "",
                alugadoPor: data.alugadoPor || "",
                dataEmprestimo: data.dataEmprestimo || "",
                dataDevolucao: data.dataDevolucao || "",
                pdfUrl: data.pdfUrl || "",
                sinopse: data.sinopse || ""
            };

            todosOsLivros.push(livro);

            const cargoAtual = localStorage.getItem('tipoUsuario');
            if (cargoAtual === 'admin') {
                renderizarLinhaTabela(livro);
            } else {
                renderizarCardUsuario(livro);
            }
        });
    } catch (error) {
        console.error("Erro ao buscar livros:", error);
    }
}

function renderizarLinhaTabela(l) {
    const corpo = document.getElementById('tabelaLivrosCorpo');
    if (!corpo) return;

    let botoesAcao = "";
    if (l.status === 'Alugado') {
        botoesAcao = `
            <button class="btn" style="background:#2563eb; color:white;" onclick="verDetalhesEmprestimo('${l.id}')">Detalhes</button>
            <button class="btn return" style="background:#28a745; color:white;" onclick="devolverLivro('${l.id}')">Devolver</button>
        `;
    } else {
        botoesAcao = `
            <button class="btn edit" onclick="abrirModalEmprestimo('${l.id}')">Alugar</button>
        `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><img src="${l.capa}" style="width:40px;height:50px;object-fit:cover;border-radius:4px"></td>
        <td><strong>${l.titulo}</strong></td>
        <td>${l.autor}</td>
        <td><span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</span></td>
        <td>
            <div style="display: flex; gap: 8px; align-items: center;">
                ${botoesAcao}
                <button class="btn delete" onclick="excluirLivro('${l.id}')">Excluir</button>
            </div>
        </td>
    `;
    corpo.appendChild(tr);
}

function renderizarCardUsuario(l) {
    const container = document.getElementById('container-cards-livros');
    if (!container) return;

    container.innerHTML += `
        <div class="book-card-v2" onclick="abrirModalDetalhesGerais('${l.id}')">
            <img src="${l.capa}" class="book-cover-v2" alt="${l.titulo}">
            <div class="book-info-v2">
                <h4>${l.titulo}</h4>
                <p class="author-v2">${l.autor}</p>
                <span class="${l.status === 'Disponível' ? 'status-livre' : 'status-alugado'}">${l.status}</span>
                <button type="button" class="btn-detalhes-v2" style="margin-top: 10px;">Ver Sinopse</button>
            </div>
        </div>`;
}

// --- MODAIS E DETALHES ---

window.verDetalhesEmprestimo = async (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    // Tratamento de data (Firebase Timestamp ou String)
    const dataFirebase = livro.dataEmprestimo;
    const dataFormatada = dataFirebase?.seconds 
        ? new Date(dataFirebase.seconds * 1000).toLocaleDateString('pt-BR') 
        : (dataFirebase || "---");

    document.getElementById('infoLivroNome').innerText = livro.titulo || "---";
    document.getElementById('infoDataInicio').innerText = dataFormatada;
    document.getElementById('infoDataFim').innerText = livro.dataDevolucao || "---";

    if (livro.alugadoPor) {
        try {
            const userRef = doc(db, "usuarios", livro.alugadoPor);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const u = userSnap.data();
                document.getElementById('infoUsuarioNome').innerText = u.nome || "Não informado";
                document.getElementById('infoUsuarioEmail').innerText = u.email || "Não informado";
                document.getElementById('infoUsuarioTelefone').innerText = u.telefone || "Não cadastrado";
                document.getElementById('infoUsuarioEndereco').innerText = u.endereco || "Não cadastrado";
                document.getElementById('infoUsuarioCidade').innerText = u.cidade || "Não cadastrado";
            }
        } catch (error) {
            console.error("Erro ao buscar dados do usuário:", error);
        }
    }
    document.getElementById('modalDetalhesEmprestimo').style.display = 'flex';
};

// --- LÓGICA DE ALUGUEL ---

window.abrirModalEmprestimo = (id) => {
    const livro = todosOsLivros.find(l => l.id === id);
    if (!livro) return;

    // Preenche o ID oculto no formulário
    const inputId = document.getElementById('idLivroModal');
    if (inputId) inputId.value = id;

    // Preenche o nome do livro no modal
    const tituloModal = document.getElementById('nomeLivroModal');
    if (tituloModal) tituloModal.innerText = livro.titulo;

    const modal = document.getElementById('modalEmprestimo');
    if (modal) modal.style.display = 'flex';
};

async function buscarUsuarioPorCPF() {
    let cpf = document.getElementById('inputUsuarioBusca').value.trim();
    
    // OPCIONAL: Se no seu Firebase o CPF estiver salvo APENAS NÚMEROS,
    // descomente a linha abaixo para limpar o CPF antes de buscar:
    // cpf = cpf.replace(/\D/g, ""); 

    const painel = document.getElementById('detalhesUsuario');
    const btn = document.getElementById('btnConfirmarEmprestimo');

    // Verifica se o CPF está completo (formatado tem 14 caracteres)
    if (cpf.length === 14 || cpf.length === 11) { 
        const q = query(collection(db, "usuarios"), where("cpf", "==", cpf));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const u = snap.docs[0].data();
            document.getElementById('info-nome').innerText = u.nome;
            document.getElementById('info-email').innerText = u.email;
            painel.style.display = 'block';
            btn.disabled = false;
        } else {
            painel.style.display = 'none';
            btn.disabled = true;
        }
    } else {
        painel.style.display = 'none';
        btn.disabled = true;
    }
}

async function salvarEmprestimoNoFirebase(e) {
    e.preventDefault();
    const idLivro = document.getElementById('idLivroModal').value;
    const cpf = document.getElementById('inputUsuarioBusca').value.trim();
    
    try {
        const q = query(collection(db, "usuarios"), where("cpf", "==", cpf));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            alert("Usuário não encontrado!");
            return;
        }

        const userDoc = snap.docs[0];
        const dataHoje = new Date();
        const dataDevolucao = new Date();
        dataDevolucao.setDate(dataHoje.getDate() + 15);

        await updateDoc(doc(db, "livros", idLivro), {
            status: "Alugado",
            usuarioAluguel: userDoc.data().nome,
            alugadoPor: userDoc.id,
            dataEmprestimo: dataHoje.toLocaleDateString('pt-BR'), // Salva a data de HOJE
            dataDevolucao: dataDevolucao.toLocaleDateString('pt-BR')
        });

        alert("Empréstimo realizado com sucesso!");
        location.reload();
    } catch (error) {
        console.error("Erro ao salvar empréstimo:", error);
        alert("Erro ao realizar empréstimo.");
    }
}

// --- OUTRAS AÇÕES ---

window.devolverLivro = async (id) => {
    if (confirm("Confirmar devolução?")) {
        await updateDoc(doc(db, "livros", id), {
            status: "Disponível",
            usuarioAluguel: "",
            alugadoPor: "",
            dataEmprestimo: "",
            dataDevolucao: ""
        });
        location.reload();
    }
};

window.excluirLivro = async (id) => {
    if (confirm("Excluir livro permanentemente?")) {
        await deleteDoc(doc(db, "livros", id));
        carregarDadosDoFirebase();
    }
};

// --- FILTROS E FECHAMENTO ---

function setupFiltros() {
    const busca = document.getElementById('inputBusca');
    const filtro = document.getElementById('filtroStatus');

    const acaoFiltrar = () => {
        const termo = busca.value.toLowerCase();
        const statusSel = filtro.value;

        document.querySelectorAll('#tabelaLivrosCorpo tr').forEach(tr => {
            const txt = tr.innerText.toLowerCase();
            const spanStatus = tr.querySelector('span');
            const status = spanStatus ? spanStatus.innerText : "";
            tr.style.display = (txt.includes(termo) && (statusSel === "Todos" || status === statusSel)) ? "" : "none";
        });

        document.querySelectorAll('.book-card-v2').forEach(card => {
            const txt = card.innerText.toLowerCase();
            const spanStatus = card.querySelector('span');
            const status = spanStatus ? spanStatus.innerText : "";
            card.style.display = (txt.includes(termo) && (statusSel === "Todos" || status === statusSel)) ? "flex" : "none";
        });
    };

    if (busca) busca.addEventListener('input', acaoFiltrar);
    if (filtro) filtro.addEventListener('change', acaoFiltrar);
}

// --- MÁSCARA DE CPF NO MODAL DE ALUGUEL ---
function aplicarMascaraCPFAluguel() {
    const inputCPF = document.getElementById('inputUsuarioBusca');

    if (inputCPF) {
        inputCPF.addEventListener('input', (e) => {
            let value = e.target.value;

            // 1. Remove tudo que não for número
            value = value.replace(/\D/g, "");

            // 2. Limita a 11 caracteres
            if (value.length > 11) value = value.slice(0, 11);

            // 3. Aplica a formatação (000.000.000-00)
            value = value.replace(/(\d{3})(\d)/, "$1.$2");
            value = value.replace(/(\d{3})(\d)/, "$1.$2");
            value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");

            e.target.value = value;

            // Chama a busca automática se o CPF estiver completo
            if (value.length === 14) {
                buscarUsuarioPorCPF();
            }
        });
    }
}

// Chame a função para iniciar o monitoramento do campo
aplicarMascaraCPFAluguel();

window.fecharModalGeral = () => {
    document.getElementById('modalDetalhesLivro').style.display = 'none';
};

window.fecharModalEmprestimo = () => {
    document.getElementById('modalEmprestimo').style.display = 'none';
};

window.fecharModalEmprestimoInfo = () => {
    document.getElementById('modalDetalhesEmprestimo').style.display = 'none';
};

window.fecharModalDetalhes = () => {
    window.fecharModalGeral();
    window.fecharModalEmprestimoInfo();
};