const container = document.querySelector(".container-index");

// --- ANIMAÇÃO DE TROCA DE TELA ---
document.getElementById("btnCadastrar").addEventListener("click", () => {
    container.classList.add("active");
});

document.getElementById("btnLogin").addEventListener("click", () => {
    container.classList.remove("active");
});
