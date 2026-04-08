import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CADASTRO ---
document.getElementById("btnCadastroTwo").addEventListener("click", async () => {
    const nome = document.getElementById('cad-nome').value;
    const email = document.getElementById('cad-email').value.trim();
    const senha = document.getElementById('cad-senha').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // SALVANDO COM O UID EXATO DO AUTH
        await setDoc(doc(db, "usuarios", user.uid), {
            nome: nome,
            email: email,
            role: 'usuario'
        });

        alert("Cadastrado com sucesso!");
        document.querySelector(".container-index").classList.remove("active");
    } catch (error) {
        alert("Erro no cadastro: " + error.message);
    }
});

// --- LOGIN ---
document.getElementById("btnEntrar").addEventListener("click", async () => {
    const email = document.getElementById('log-email').value.trim();
    const senha = document.getElementById('log-senha').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // BUSCANDO PELO UID QUE ACABOU DE LOGAR
        const docRef = doc(db, "usuarios", user.uid);
        const userDoc = await getDoc(docRef);

        if (userDoc.exists()) {
            const dados = userDoc.data();
            localStorage.setItem('usuarioLogado', dados.nome);
            localStorage.setItem('userRole', dados.role);
            
            alert("Login realizado!");
            window.location.href = "pages/dashboard.html";
        } else {
            // Se cair aqui, o ID no Firestore está diferente do ID no Auth
            console.error("UID Logado:", user.uid);
            alert("Erro crítico: Usuário autenticado, mas ficha não encontrada no banco.");
        }
    } catch (error) {
        alert("E-mail ou senha incorretos.");
    }
});

const container = document.querySelector('.container-index');
const btnCadastrar = document.getElementById('btnCadastrar'); // Botão desktop
const btnLogin = document.getElementById('btnLogin');         // Botão desktop
const switchToRegister = document.getElementById('switchToRegister'); // Link mobile
const switchToLogin = document.getElementById('switchToLogin');       // Link mobile

// Função para ativar modo Cadastro
const ativarCadastro = () => container.classList.add('active');

// Função para ativar modo Login
const ativarLogin = () => container.classList.remove('active');

btnCadastrar?.addEventListener('click', ativarCadastro);
switchToRegister?.addEventListener('click', ativarCadastro);

btnLogin?.addEventListener('click', ativarLogin);
switchToLogin?.addEventListener('click', ativarLogin);