document.getElementById('startBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // Посылаем сообщение "start" в content.js
    try {
        await chrome.tabs.sendMessage(tab.id, {action: "start"});
        window.close();
    } catch (e) {
        // Если скрипт еще не загрузился (редкий случай) или это не карты
        alert("Пожалуйста, обновите страницу или убедитесь, что вы на Яндекс Картах.");
    }
});