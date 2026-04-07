import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const formLogin = document.getElementById('seu-form-login');

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    try {
        // 1. Faz o login no Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // 2. Busca o documento do usuário no Firestore para saber o cargo
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // --- ALTERAÇÃO IMPORTANTE: Salva os dados para uso nas outras páginas ---
            localStorage.setItem('usuarioLogado', JSON.stringify({
                uid: user.uid,
                email: user.email,
                role: userData.role || "comum" // Garante um valor padrão
            }));

            // Salva apenas o role de forma simples para facilitar a leitura no books.js
            localStorage.setItem('tipoUsuario', userData.role || "comum");

            // 3. Redireciona conforme o cargo
            // Nota: Se ambos usam a dashboard, você pode redirecionar todos para dashboard.html
            // e lá dentro o JS decide o que mostrar.
            if (userData.role === "admin") {
                window.location.href = "admin.html"; 
            } else {
                window.location.href = "dashboard.html";
            }
        } else {
            // Caso o usuário exista no Auth mas não tenha documento no Firestore
            console.error("Documento do usuário não encontrado no Firestore.");
            alert("Erro ao recuperar perfil do usuário.");
        }
    } catch (error) {
        console.error("Erro no login:", error.code);
        alert("Email ou senha incorretos ou erro de conexão.");
    }
});