import { auth, db } from './firebase.js';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, getDoc, updateDoc, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURAÇÃO GOOGLE API ---
const CLIENT_ID = "1006307822713-nkatf83ga031gqd9557t834ua8ijbou7.apps.googleusercontent.com"; 
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
let tokenClient;

// --- VARIÁVEIS DE ESTADO ---
let todasAsReunioes = [];
let todosOsLivrosDados = [];
let usuarioIdAtual = null; // Guardará o UID do Firebase

const usuarioAtual = localStorage.getItem('usuarioLogado') || "Usuário Anônimo";
const usuarioCargo = localStorage.getItem('userRole');

// Monitor de Autenticação para pegar o ID real
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioIdAtual = user.uid;
    }
});

/**
 * 1. INICIALIZAÇÃO GOOGLE E CARREGAMENTO
 */
function initGoogleAuth() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
            if (response.error !== undefined) throw response;
            await criarReuniaoComLinkReal(response.access_token);
        },
    });
}

async function carregarDados() {
    try {
        const snapLivros = await getDocs(collection(db, "livros"));
        todosOsLivrosDados = [];
        snapLivros.forEach(d => {
            const data = d.data();
            todosOsLivrosDados.push({ titulo: data.titulo || data.nome, capa: data.capa });
        });

        inicializarBuscaVisual();

        const q = query(collection(db, "reunioes"), orderBy("timestamp", "asc"));
        const snapReunioes = await getDocs(q);
        todasAsReunioes = snapReunioes.docs.map(d => ({ id: d.id, ...d.data() }));
        
        renderizarReunioes(todasAsReunioes);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

/**
 * 2. CONTROLE DO MODAL E PARTICIPAÇÃO
 */
window.abrirDetalhes = (id) => {
    const reuniao = todasAsReunioes.find(r => r.id === id);
    if (!reuniao) return;

    const modal = document.getElementById("modal-detalhes");
    const conteudo = document.getElementById("conteudo-modal");

    // Verifica se o usuário já participa
    const jaParticipa = reuniao.participantes?.includes(usuarioIdAtual);

    if (modal && conteudo) {
        conteudo.innerHTML = `
            <h2 style="color: #333; margin-top:0;">${reuniao.livro}</h2>
            <p style="font-size:0.9rem; color:#666;">Organizado por: ${reuniao.criadoPor}</p>
            <hr style="opacity:0.2">
            <p><strong>Descrição:</strong><br>${reuniao.descricao || "Sem pauta definida."}</p>
            <br>
            <a href="${reuniao.link}" target="_blank" style="display:block; text-align:center; background:#28a745; color:white; padding:12px; text-decoration:none; border-radius:5px; font-weight:bold;">
               Entrar no Google Meet
            </a>

            ${!jaParticipa ? `
                <button onclick="participarDaReuniao('${reuniao.id}')" style="width:100%; margin-top:10px; padding:12px; background:#007bff; color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">
                    Confirmar Minha Presença
                </button>
            ` : `<p style="text-align:center; color:green; font-weight:bold; margin-top:10px;">✅ Você está confirmado nesta reunião</p>`}

            <button id="btn-fechar-modal" style="width:100%; margin-top:10px; padding:10px; background:#eee; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
               Fechar
            </button>
        `;
        modal.style.display = "block";
    }
};

window.participarDaReuniao = async (idReuniao) => {
    if (!usuarioIdAtual) return alert("Você precisa estar logado!");
    
    try {
        const ref = doc(db, "reunioes", idReuniao);
        const snap = await getDoc(ref);
        const dados = snap.data();
        
        let lista = dados.participantes || [];
        
        if (!lista.includes(usuarioIdAtual)) {
            lista.push(usuarioIdAtual);
            await updateDoc(ref, { participantes: lista });
            alert("Presença confirmada! Agora esta reunião aparecerá no seu Dashboard.");
            location.reload();
        }
    } catch (e) {
        console.error("Erro ao participar:", e);
    }
};

/**
 * 3. AGENDAR REUNIÃO
 */
async function criarReuniaoComLinkReal(accessToken) {
    const livro = document.getElementById("input-livro").value;
    const data = document.getElementById("data-reuniao").value;
    const desc = document.getElementById("desc-reuniao").value;

    const dataInicio = new Date(data);
    const dataFim = new Date(dataInicio.getTime() + (60 * 60 * 1000));

    const event = {
        'summary': `Debate LibreHub: ${livro}`,
        'description': desc,
        'start': { 'dateTime': dataInicio.toISOString(), 'timeZone': 'America/Sao_Paulo' },
        'end': { 'dateTime': dataFim.toISOString(), 'timeZone': 'America/Sao_Paulo' },
        'conferenceData': {
            'createRequest': {
                'requestId': "librehub_" + Date.now(),
                'conferenceSolutionKey': { 'type': 'hangoutsMeet' }
            }
        }
    };

    try {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        const result = await response.json();
        const linkMeetReal = result.hangoutLink || (result.conferenceData?.entryPoints?.[0]?.uri);

        if (linkMeetReal) {
            await addDoc(collection(db, "reunioes"), {
                livro,
                data,
                descricao: desc,
                link: linkMeetReal,
                criadoPor: usuarioAtual,
                usuarioId: usuarioIdAtual, // UID do criador
                participantes: [usuarioIdAtual], // O criador já entra como participante
                timestamp: serverTimestamp()
            });
            alert("Sucesso! Reunião agendada.");
            location.reload();
        }
    } catch (e) {
        console.error("Erro crítico na execução:", e);
    }
}

/**
 * 4. AUTOCOMPLETE E RENDERIZAÇÃO
 */
async function renderizarReunioes(lista) {
    const container = document.getElementById("lista-reunioes");
    if (!container) return;
    if (lista.length === 0) { container.innerHTML = "<p>Nenhuma reunião encontrada.</p>"; return; }

    const cardsArray = await Promise.all(lista.map(async (r) => {
        const livroData = todosOsLivrosDados.find(l => l.titulo === r.livro);
        const capaUrl = livroData ? livroData.capa : "../img/default-book.png";
        const podeExcluir = r.usuarioId === usuarioIdAtual || usuarioCargo === 'admin';
        const dataObj = new Date(r.data);

        return `
            <div class="card-reuniao">
                <img src="${capaUrl}" class="capa-reuniao" alt="Capa">
                <div class="card-body">
                    <h4>${r.livro}</h4>
                    <p>📅 ${dataObj.toLocaleDateString('pt-BR')}</p>
                    <p>⏰ ${dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <button class="btn-detalhes" onclick="abrirDetalhes('${r.id}')">Ver Detalhes</button>
                ${podeExcluir ? `<button class="btn-excluir" data-id="${r.id}" style="background:#ff4d4d; color:white; border:none; padding:8px; cursor:pointer; margin-top:5px; border-radius:4px; width:100%;">Excluir</button>` : ""}
            </div>
        `;
    }));
    container.innerHTML = cardsArray.join("");
}

// --- Resto das funções de UI (Filtros, Tabs, Busca) permanecem iguais ---
document.getElementById("btnCriarReuniao")?.addEventListener("click", () => {
    const livro = document.getElementById("input-livro").value;
    const data = document.getElementById("data-reuniao").value;
    if (!livro || !data) return alert("Preencha livro e data!");
    tokenClient.requestAccessToken();
});

function inicializarBuscaVisual() {
    const inputLivro = document.getElementById('input-livro');
    const containerResultados = document.getElementById('busca-resultados');
    if (!inputLivro || !containerResultados) return;

    inputLivro.addEventListener('input', () => {
        const termo = inputLivro.value.toLowerCase();
        containerResultados.innerHTML = "";
        if (termo.length === 0) { containerResultados.style.display = "none"; return; }
        const filtrados = todosOsLivrosDados.filter(l => l.titulo.toLowerCase().includes(termo));
        if (filtrados.length > 0) {
            containerResultados.style.display = "block";
            filtrados.forEach(livro => {
                const div = document.createElement('div');
                div.style = "display:flex; align-items:center; padding:10px; cursor:pointer; border-bottom:1px solid #eee; background:white; color:black;";
                div.innerHTML = `<img src="${livro.capa || '../img/default-book.png'}" style="width:30px; height:45px; object-fit:cover; margin-right:10px; border-radius:2px;">
                                 <span style="font-size:14px; font-weight:bold;">${livro.titulo}</span>`;
                div.onclick = () => { inputLivro.value = livro.titulo; containerResultados.style.display = "none"; };
                containerResultados.appendChild(div);
            });
        }
    });
}

document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;
        document.querySelectorAll('.tab-btn, .tab-pane').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(targetId)?.classList.add('active');
    });
});

document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-excluir")) {
        const id = e.target.dataset.id;
        if (confirm("Deseja excluir esta reunião?")) {
            await deleteDoc(doc(db, "reunioes", id));
            location.reload();
        }
    }
});

window.onload = () => {
    initGoogleAuth();
    carregarDados();
};