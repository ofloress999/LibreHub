import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos de imagem para atualizar em conjunto
const headerProfileImg = document.getElementById('profileBtn');
const avatarPreview = document.getElementById('avatar-preview');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const dados = userDoc.data();
            
            if (dados.role === "admin") {
                const linkAdmin = document.getElementById('link-admin');
                if (linkAdmin) linkAdmin.style.display = 'block';
            }

            // Preenche os campos
            document.getElementById('nome-usuario-display').innerText = dados.nome || "Usuário";
            document.getElementById('email-usuario-display').innerText = user.email;
            document.getElementById('perfil-nome').value = dados.nome || "";
            document.getElementById('perfil-cpf').value = dados.cpf || "";
            document.getElementById('perfil-telefone').value = dados.telefone || "";

            // Atualiza as fotos (Avatar grande e Ícone do Header)
            if (dados.fotoUrl) {
                const imgHTML = `<img src="${dados.fotoUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                avatarPreview.innerHTML = imgHTML;
                if (headerProfileImg) headerProfileImg.src = dados.fotoUrl;
            }
        }
    } else {
        window.location.href = "login.html";
    }

    if (user) {
        // 1. Tenta buscar a foto no Firestore
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        
        if (userDoc.exists()) {
            const dados = userDoc.data();
            const profileBtn = document.getElementById('profileBtn');

            // 2. Se houver uma foto salva, atualiza o ícone superior
            if (dados.fotoUrl && profileBtn) {
                profileBtn.src = dados.fotoUrl;
                profileBtn.style.objectFit = "cover";
                profileBtn.style.borderRadius = "50%"; // Garante que fique redondo
            }
        }
    } else {
        window.location.href = "../index.html";
    }
});

// Preview da foto ao selecionar arquivo (Troca no header e no preview grande)
document.getElementById('input-foto').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const tempUrl = event.target.result;
            
            // Atualiza preview grande
            avatarPreview.innerHTML = `<img src="${tempUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            
            // Atualiza ícone do header instantaneamente
            if (headerProfileImg) headerProfileImg.src = tempUrl;
        };
        reader.readAsDataURL(file);
    }
});

// Salvar alterações
document.getElementById('form-perfil-edit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    // Se você estiver salvando a URL da imagem no Firestore, 
    // certifique-se de pegar a URL atual da imagem de preview
    const imgElement = avatarPreview.querySelector('img');
    const fotoUrlAtual = imgElement ? imgElement.src : "";

    const novosDados = {
        nome: document.getElementById('perfil-nome').value,
        cpf: document.getElementById('perfil-cpf').value,
        telefone: document.getElementById('perfil-telefone').value,
        fotoUrl: fotoUrlAtual // Salva a nova foto no banco
    };

    try {
        await updateDoc(doc(db, "usuarios", user.uid), novosDados);
        
        // Atualiza o nome no display após salvar
        document.getElementById('nome-usuario-display').innerText = novosDados.nome;
        
        alert("Perfil atualizado com sucesso!");
    } catch (error) {
        console.error("Erro:", error);
        alert("Falha ao atualizar perfil.");
    }
});