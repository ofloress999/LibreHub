import { auth, db } from './firebase.js'; 
import { 
    doc, getDoc, collection, getDocs, query, where, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. Carrega foto de perfil
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const dados = userDoc.data();
                const profileBtn = document.getElementById('profileBtn');
                if (dados.fotoUrl && profileBtn) {
                    profileBtn.src = dados.fotoUrl;
                }
            }

            carregarDadosContadores(user.uid);
            carregarLivrosRecentes();

        } else {
            window.location.href = "../index.html";
        }
    });

    initGlobalFeatures();
});

// --- FUNÇÃO PARA FECHAR QUALQUER MODAL (GLOBAL) ---
// Penduramos no window para que onclicks no HTML funcionem
window.fecharModalGeral = (idModal) => {
    const modal = document.getElementById(idModal);
    if (modal) modal.style.display = "none";
};

// --- FUNÇÃO QUE BUSCA OS NÚMEROS REAIS ---
async function carregarDadosContadores(userId) {
    try {
        // 1. LIVROS ALUGADOS
        const qAlugados = query(
            collection(db, "alugueis"), 
            where("usuarioId", "==", userId), 
            where("status", "==", "ativo")
        );
        const snapAlugados = await getDocs(qAlugados);
        const elAlugados = document.getElementById('dash-meus-alugados');
        if (elAlugados) elAlugados.innerText = snapAlugados.size;

        // 2. LIVROS LIDOS
        const qLidos = query(
            collection(db, "alugueis"), 
            where("usuarioId", "==", userId), 
            where("status", "==", "devolvido")
        );
        const snapLidos = await getDocs(qLidos);
        const elLidos = document.getElementById('dash-livros-lidos');
        if (elLidos) elLidos.innerText = snapLidos.size;

        // 3. REUNIÕES
        const qReunioes = query(
            collection(db, "reunioes"), 
            where("participantes", "array-contains", userId)
        );
        const snapReunioes = await getDocs(qReunioes);
        const elReunioes = document.getElementById('dash-minhas-reunioes');
        if (elReunioes) elReunioes.innerText = snapReunioes.size;

    } catch (error) {
        console.error("Erro ao carregar contadores:", error);
    }
}

async function carregarLivrosRecentes() {
    const container = document.getElementById('recent-books-container');
    if (!container) return;

    try {
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
    // Menu Sidebar
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.onclick = () => sidebar.classList.toggle('active');
    }

    // Tema
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
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

    // --- LÓGICA DE FECHAMENTO DE MODAIS CORRIGIDA ---
    document.addEventListener('click', (e) => {
        // Fecha dropdown ao clicar fora
        if (dropdown && !profileBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
        
        // 1. Fechar ao clicar no fundo escuro (overlay)
        if (e.target.classList.contains('modal')) {
            e.target.style.display = "none";
        }

        // 2. Fechar ao clicar no botão "X" (classe close-modal)
        if (e.target.classList.contains('close-modal')) {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = "none";
        }

        // 3. CORREÇÃO: Fechar ao clicar no botão que tem o ID 'btn-fechar-modal'
        // ou que simplesmente contenha o texto "Fechar"
        if (e.target.id === 'btn-fechar-modal' || e.target.getAttribute('onclick')?.includes('fecharModal')) {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = "none";
        }
    });
}