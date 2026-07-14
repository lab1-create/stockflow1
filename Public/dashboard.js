document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard carregado com sucesso!');

    // Seleciona o botão "Novo Usuário" pelo ID que vimos no seu print
    const newUserButton = document.getElementById('new-user-button');

    if (newUserButton) {
        newUserButton.addEventListener('click', () => {
            // Aqui vai a ação do que o botão deve fazer (ex: abrir um formulário ou alerta)
            alert('Botão Novo Usuário clicado! O script foi recuperado com sucesso.');

            // Se você tiver uma caixinha/modal oculta no HTML para cadastrar usuário, 
            // podemos fazê-la aparecer aqui. Exemplo:
            const userModal = document.getElementById('user-modal');
            if (userModal) {
                userModal.style.display = 'block';
            }
        });
    } else {
        console.log('Botão Novo Usuário não foi encontrado na página.');
    }
});