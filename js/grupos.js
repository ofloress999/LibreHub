import { db } from './firebase.js';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let todasAsReunioes = [];
let todosOsLivros = []; // Para o autocomplete
const usuarioAtual = localStorage.getItem('usuarioLogado');

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
    container.innerHTML = "<p>Carregando reuniões...</p>";

    if (lista.length === 0) {
        container.innerHTML = "<p>Nenhuma reunião encontrada.</p>";
        return;
    }

    const htmlCards = await Promise.all(lista.map(async (r) => {
        const capaUrl = await buscarCapaLivro(r.livro);
        const souDono = r.criadoPor === usuarioAtual;
        const dataObj = new Date(r.data);

        return `
            <div class="card-reuniao">
                <img src="${capaUrl}" class="capa-reuniao" alt="Capa do livro">
                <div class="card-body">
                    <h4>${r.livro}</h4>
                    <p>📅 ${dataObj.toLocaleDateString()}</p>
                    <p>⏰ ${dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <button class="btn-detalhes" onclick="abrirDetalhes('${r.id}')">Ver Detalhes</button>
                ${souDono ? `<button class="btn-excluir-reuniao" onclick="excluirReuniao('${r.id}')">Excluir</button>` : ""}
            </div>
        `;
    }));

    container.innerHTML = htmlCards.join("");
}

// --- 3. FILTROS E PESQUISA ---

// Carregar livros para o Autocomplete (Aba Agendar)
async function inicializarAutocomplete() {
    const querySnapshot = await getDocs(collection(db, "livros"));
    const datalist = document.getElementById('sugestoes-livros');
    todosOsLivros = [];
    datalist.innerHTML = "";
    
    querySnapshot.forEach(docSnap => {
        const titulo = docSnap.data().titulo;
        if (titulo) {
            todosOsLivros.push(titulo);
            const opt = document.createElement('option');
            opt.value = titulo;
            datalist.appendChild(opt);
        }
    });
}

// Filtro da aba "Encontrar Reuniões"
document.getElementById('filtro-reuniao').addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    const filtradas = todasAsReunioes.filter(r => 
        r.livro.toLowerCase().includes(termo)
    );
    renderizarReunioes(filtradas);
});

// --- 4. MODAL DE DETALHES ---

window.abrirDetalhes = (id) => {
    const reuniao = todasAsReunioes.find(r => r.id === id);
    const modal = document.getElementById("modal-detalhes");
    const conteudo = document.getElementById("conteudo-modal");

    conteudo.innerHTML = `
        <h2 style="margin-top:0">${reuniao.livro}</h2>
        <hr>
        <p><strong>Descrição:</strong><br>${reuniao.descricao || "Nenhuma descrição informada."}</p>
        <p><strong>Participantes (${reuniao.participantes ? reuniao.participantes.length : 0}):</strong></p>
        <ul style="max-height: 150px; overflow-y: auto;">
            ${reuniao.participantes ? reuniao.participantes.map(p => `<li>${p}</li>`).join("") : "<li>Apenas o criador</li>"}
        </ul>
        <br>
        <a href="${reuniao.link}" target="_blank" class="btn-entrar-meet">Entrar no Google Meet</a>
    `;
    modal.style.display = "block";
};

// Fechar Modal
document.querySelector(".close-modal").onclick = () => document.getElementById("modal-detalhes").style.display = "none";
window.onclick = (event) => {
    if (event.target == document.getElementById("modal-detalhes")) {
        document.getElementById("modal-detalhes").style.display = "none";
    }
};

// --- 5. AÇÕES (CRIAR E EXCLUIR) ---

document.getElementById("btnCriarReuniao").addEventListener("click", async () => {
    const livro = document.getElementById("input-livro").value;
    const data = document.getElementById("data-reuniao").value;
    const desc = document.getElementById("desc-reuniao").value;

    if(!livro || !data) return alert("Preencha o livro e a data!");

    try {
        await addDoc(collection(db, "reunioes"), {
            livro,
            data,
            descricao: desc,
            link: `https://meet.google.com/new`, // Link padrão
            criadoPor: usuarioAtual,
            participantes: [usuarioAtual],
            timestamp: new Date(data).getTime()
        });

        alert("Reunião agendada!");
        window.location.reload();
    } catch (e) { console.error(e); }
});

window.excluirReuniao = async (id) => {
    if (confirm("Deseja realmente excluir esta reunião?")) {
        try {
            await deleteDoc(doc(db, "reunioes", id));
            alert("Reunião removida!");
            window.location.reload();
        } catch (e) { alert("Erro ao excluir."); }
    }
};

// --- 6. CARREGAMENTO INICIAL ---

async function carregarDados() {
    const q = query(collection(db, "reunioes"), orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(q);
    todasAsReunioes = [];
    querySnapshot.forEach(docSnap => {
        todasAsReunioes.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderizarReunioes(todasAsReunioes);
    inicialisarAutocomplete();
}

carregarDados();