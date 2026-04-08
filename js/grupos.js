import { db } from './firebase.js';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let todasAsReunioes = [];
let todosOsLivrosDados = []; 
let nomesDosLivros = [];    
const usuarioAtual = localStorage.getItem('usuarioLogado') || "Usuário Anônimo";
const usuarioCargo = localStorage.getItem('usuarioCargo'); // Pega o cargo do admin

// --- 1. LÓGICA DAS ABAS ---
const tabs = document.querySelectorAll('.tab-btn');
const panes = document.querySelectorAll('.tab-pane');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(target).classList.add('active');
    });
});

// --- 2. BUSCA DE CAPA E RENDERIZAÇÃO ---
async function buscarCapaLivro(titulo) {
    const q = query(collection(db, "livros"), where("titulo", "==", titulo));
    const snap = await getDocs(q);
    if (!snap.empty) {
        return snap.docs[0].data().capa || "../img/default-book.png";
    }
    return "../img/default-book.png";
}

async function renderizarReunioes(lista) {
    const container = document.getElementById("lista-reunioes");
    if (!container) return;
    container.innerHTML = "<p>Carregando reuniões...</p>";
    
    if (lista.length === 0) {
        container.innerHTML = "<p>Nenhuma reunião encontrada.</p>";
        return;
    }

    const cardsArray = await Promise.all(lista.map(async (r) => {
        const capaUrl = await buscarCapaLivro(r.livro);
        
        // REGRA DE EXCLUSÃO: Dono ou Admin
        const podeExcluir = r.criadoPor === usuarioAtual || usuarioCargo === 'admin';
        
        const dataObj = new Date(r.data);
        return `
            <div class="card-reuniao">
                <img src="${capaUrl}" class="capa-reuniao" alt="Capa">
                <div class="card-body">
                    <h4>${r.livro}</h4>
                    <p>📅 ${dataObj.toLocaleDateString()}</p>
                    <p>⏰ ${dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <button class="btn-detalhes" onclick="abrirDetalhes('${r.id}')">Ver Detalhes</button>
                ${podeExcluir ? `<button class="btn-excluir-reuniao" onclick="excluirReuniao('${r.id}')" style="background:#ff4d4d; color:white; border:none; padding:8px; cursor:pointer; margin-top:5px; border-radius:4px; width:100%;">Excluir</button>` : ""}
            </div>
        `;
    }));
    container.innerHTML = cardsArray.join("");
}

// --- 3. NOVA BUSCA VISUAL ---
async function inicializarBuscaVisual() {
    const inputLivro = document.getElementById('input-livro');
    const containerResultados = document.getElementById('busca-resultados');
    
    if(!inputLivro || !containerResultados) return;

    const querySnapshot = await getDocs(collection(db, "livros"));
    todosOsLivrosDados = [];
    nomesDosLivros = [];

    querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const titulo = data.titulo || data.nome;
        if (titulo) {
            todosOsLivrosDados.push({ titulo, capa: data.capa });
            nomesDosLivros.push(titulo);
        }
    });

    inputLivro.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        containerResultados.innerHTML = "";
        
        if (termo.length === 0) {
            containerResultados.style.display = "none";
            return;
        }

        const filtrados = todosOsLivrosDados.filter(l => l.titulo.toLowerCase().includes(termo));

        if (filtrados.length > 0) {
            containerResultados.style.display = "block";
            filtrados.forEach(livro => {
                const div = document.createElement('div');
                div.className = 'item-busca-custom'; 
                div.style = "display:flex; align-items:center; padding:10px; cursor:pointer; border-bottom:1px solid #eee;";
                div.innerHTML = `
                    <img src="${livro.capa || '../img/default-book.png'}" style="width:40px; height:55px; object-fit:cover; border-radius:4px; margin-right:10px;">
                    <span style="font-size: 14px; font-weight: 500;">${livro.titulo}</span>
                `;
                
                div.addEventListener('click', () => {
                    inputLivro.value = livro.titulo;
                    containerResultados.style.display = "none";
                });
                
                containerResultados.appendChild(div);
            });
        } else {
            containerResultados.style.display = "none";
        }
    });

    document.addEventListener('click', (e) => {
        if (!inputLivro.contains(e.target) && !containerResultados.contains(e.target)) {
            containerResultados.style.display = "none";
        }
    });
}

// --- 4. FUNÇÕES GLOBAIS (MODAL E EXCLUSÃO) ---
window.abrirDetalhes = (id) => {
    const reuniao = todasAsReunioes.find(r => r.id === id);
    if (!reuniao) return;
    const modal = document.getElementById("modal-detalhes");
    const conteudo = document.getElementById("conteudo-modal");
    conteudo.innerHTML = `
        <h2 style="margin-top:0">${reuniao.livro}</h2>
        <hr>
        <p><strong>Descrição:</strong><br>${reuniao.descricao || "Sem descrição."}</p>
        <p><strong>Organizado por:</strong> ${reuniao.criadoPor}</p>
        <br>
        <a href="${reuniao.link}" target="_blank" class="btn-entrar-meet" style="display:block; text-align:center; background:#28a745; color:white; padding:10px; text-decoration:none; border-radius:5px;">Entrar no Google Meet</a>
    `;
    modal.style.display = "block";
};

window.excluirReuniao = async (id) => {
    const r = todasAsReunioes.find(item => item.id === id);
    const msg = (usuarioCargo === 'admin' && r.criadoPor !== usuarioAtual) 
                ? "Admin: Deseja excluir a reunião de outro usuário?" 
                : "Deseja excluir esta reunião?";

    if (confirm(msg)) {
        try {
            await deleteDoc(doc(db, "reunioes", id));
            alert("Reunião removida!");
            carregarDados(); 
        } catch (e) {
            alert("Erro ao excluir.");
        }
    }
};

// --- 5. AÇÃO DE CRIAR ---
document.getElementById("btnCriarReuniao")?.addEventListener("click", async () => {
    const livroInput = document.getElementById("input-livro");
    const livroNome = livroInput.value.trim();
    const dataReuniao = document.getElementById("data-reuniao").value;
    const desc = document.getElementById("desc-reuniao").value;

    if(!livroNome || !dataReuniao) return alert("Preencha livro e data!");

    if (!nomesDosLivros.includes(livroNome)) {
        alert("Erro: Este livro não existe na biblioteca. Selecione uma opção na lista.");
        return;
    }

    try {
        await addDoc(collection(db, "reunioes"), {
            livro: livroNome,
            data: dataReuniao,
            descricao: desc,
            link: `https://meet.google.com/new`, 
            criadoPor: usuarioAtual,
            timestamp: new Date(dataReuniao).getTime()
        });
        alert("Reunião agendada!");
        location.reload();
    } catch (e) { console.error(e); }
});

// --- 6. CARREGAMENTO INICIAL ---
async function carregarDados() {
    try {
        await inicializarBuscaVisual();
        const q = query(collection(db, "reunioes"), orderBy("timestamp", "asc"));
        const snap = await getDocs(q);
        todasAsReunioes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarReunioes(todasAsReunioes);
    } catch (error) {
        console.error("Erro ao carregar:", error);
    }
}

carregarDados();