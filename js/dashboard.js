import { auth, db } from './firebase.js'; 
import { 
    doc, getDoc, collection, getDocs, query, where, limit, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tema salvo
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Carregar Foto de Perfil
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const dados = userDoc.data();
                if (dados.fotoUrl) document.getElementById('profileBtn').src = dados.fotoUrl;
            }

            // --- CHAMADA DAS FUNÇÕES DE DADOS REAIS ---
            carregarDadosContadores(user.uid);
            carregarLivrosRecentes();
        } else {
            window.location.href = "../index.html";
        }
    });

    initGlobalFeatures();
});

// --- FUNÇÃO QUE BUSCA OS NÚMEROS REAIS ---
async function carregarDadosContadores(userId) {
    try {
        // 1. LIVROS ALUGADOS (Status: 'ativo')
        const qAlugados = query(
            collection(db, "alugueis"), 
            where("usuarioId", "==", userId), 
            where("status", "==", "ativo")
        );
        const snapAlugados = await getDocs(qAlugados);
        document.getElementById('dash-meus-alugados').innerText = snapAlugados.size;

        // 2. LIVROS LIDOS (Status: 'devolvido')
        const qLidos = query(
            collection(db, "alugueis"), 
            where("usuarioId", "==", userId), 
            where("status", "==", "devolvido")
        );
        const snapLidos = await getDocs(qLidos);
        document.getElementById('dash-livros-lidos').innerText = snapLidos.size;

        // 3. MINHAS REUNIÕES (Onde o usuário é participante)
        const qReunioes = query(
            collection(db, "reunioes"), 
            where("participantes", "array-contains", userId)
        );
        const snapReunioes = await getDocs(qReunioes);
        document.getElementById('dash-minhas-reunioes').innerText = snapReunioes.size;

    } catch (error) {
        console.error("Erro ao carregar contadores:", error);
    }
}

// --- FUNÇÃO PARA OS CARDS PEQUENOS (RECENTES) ---
async function carregarLivrosRecentes() {
    const container = document.getElementById('recent-books-container');
    if (!container) return;

    try {
        // Pega os 4 últimos livros
        const q = query(collection(db, "livros"), limit(4));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        snap.forEach(docSnap => {
            const l = docSnap.data();
            container.innerHTML += `
                <div class="book-card-small" onclick="window.location.href='books.html'">
                    <img src="${l.capa || '../img/default-book.png'}" class="book-cover-small">
                    <div class="book-info-small">
                        <h3>${l.titulo}</h3>
                        <p>${l.autor}</p>
                    </div>
                </div>`;
        });
    } catch (error) {
        console.log("Erro na vitrine:", error);
    }
}

function initGlobalFeatures() {
    // Lógica de Menu, Dark Mode e Dropdown (seus códigos padrão)
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
        };
    }
}