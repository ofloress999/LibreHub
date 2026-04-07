import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const formCadastro = document.getElementById('seu-form-cadastro');

formCadastro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const nome = document.getElementById('nome').value;

    try {
        // 1. Cria o usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // 2. Salva os dados adicionais no Firestore usando o UID do usuário como ID do documento
        await setDoc(doc(db, "usuarios", user.uid), {
            nome: nome,
            email: email,
            role: "usuario", // Por padrão, todo novo cadastro é usuário comum
            dataCadastro: new Date()
        });

        alert("Usuário cadastrado com sucesso!");
        window.location.href = "login.html";
    } catch (error) {
        alert("Erro ao cadastrar: " + error.message);
    }
});