import { auth, db } from './firebase.js'; 
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. Carrega dados do perfil (Foto)
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const dados = userDoc.data();
                const profileBtn = document.getElementById('profileBtn');
                if (dados.fotoUrl && profileBtn) {
                    profileBtn.src = dados.fotoUrl;
                    profileBtn.style.objectFit = "cover";
                    profileBtn.style.borderRadius = "50%";
                }
                
                // Atualiza o cargo no localStorage caso tenha mudado no banco
                if (dados.role) {
                    localStorage.setItem('tipoUsuario', dados.role);
                }
            }
        } else {
            // Se não houver usuário logado, volta para o login
            window.location.href = "../index.html";
        }
    });

    initGlobalFeatures();
    setupMascaras();
});

// --- FUNÇÕES GLOBAIS (TEMA E MENU) ---

function initGlobalFeatures() {
    // Lógica do Tema (Dark Mode)
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            const isDark = document.body.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        };
    }
    
    // Aplica o tema salvo ao carregar
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
    }

    // Dropdown do Menu de Perfil
    const profileBtn = document.getElementById('profileBtn');
    const dropdown = document.getElementById('dropdown');
    
    if (profileBtn && dropdown) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        };
    }

    // Fecha o dropdown ao clicar em qualquer lugar da tela
    document.addEventListener('click', () => {
        if (dropdown) dropdown.classList.remove('show');
    });
}

// --- MÁSCARAS DE INPUT ---

function setupMascaras() {
    const inputCpf = document.getElementById('perfil-cpf');

    if (inputCpf) {
        inputCpf.addEventListener('input', (e) => {
            let value = e.target.value;

            // 1. Remove tudo que não for número
            value = value.replace(/\D/g, "");

            // 2. Limita a 11 caracteres
            if (value.length > 11) value = value.slice(0, 11);

            // 3. Aplica a formatação dinamicamente (000.000.000-00)
            value = value.replace(/(\d{3})(\d)/, "$1.$2");
            value = value.replace(/(\d{3})(\d)/, "$1.$2");
            value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");

            e.target.value = value;
        });
    }
}