(async () => {
    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Ожидание элемента
    async function waitForElement(selector, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) return el;
            await sleep(300);
        }
        return null;
    }

    // Ожидание загрузки карточек отзывов
    async function waitForReviewsToLoad(timeout = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const cards = document.querySelectorAll('.business-review-view');
            if (cards.length > 0) return true;
            await sleep(500);
        }
        return false;
    }

    // Поп-ап уведомление
    function showSuccessPopup(count, fileName) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '999998'
        });
        
        const popup = document.createElement('div');
        Object.assign(popup.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: 'white', padding: '25px', borderRadius: '10px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)', zIndex: '999999',
            fontFamily: 'Arial, sans-serif', textAlign: 'center', minWidth: '300px'
        });

        popup.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 10px;">✅</div>
            <h2 style="margin: 0 0 10px 0; color: #333;">Готово!</h2>
            <p style="margin: 10px 0; font-size: 16px; color: #555;">Собрано отзывов: <b>${count}</b></p>
            <p style="margin: 5px 0 20px 0; font-size: 12px; color: #999;">Файл: ${fileName}</p>
            <button id="closePopupBtn" style="background-color: #4CAF50; color: white; border: none; padding: 10px 25px; font-size: 16px; borderRadius: 5px; cursor: pointer;">ОК</button>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(popup);
        document.getElementById('closePopupBtn').addEventListener('click', () => {
            popup.remove();
            overlay.remove();
        });
    }

    // Сортировка
    async function applySorting() {
        const sortTrigger = document.querySelector('.rating-ranking-view');
        if (!sortTrigger) { console.warn("⚠️ Кнопка сортировки не найдена."); return; }
        if (sortTrigger.innerText.toLowerCase().includes('по новизне')) { console.log("✅ Сортировка OK."); return; }

        console.log("⚙️ Сортировка...");
        for (let attempt = 1; attempt <= 3; attempt++) {
            sortTrigger.click();
            const targetOption = await waitForElement('.rating-ranking-view__popup-line[aria-label="По новизне"]', 2000);
            if (targetOption) {
                targetOption.click();
                const startWait = Date.now();
                while (Date.now() - startWait < 5000) {
                    if (sortTrigger.innerText.toLowerCase().includes('по новизне')) {
                        await sleep(3000); 
                        return;
                    }
                    await sleep(500);
                }
            } else {
                await sleep(1000);
            }
        }
    }

    // === ГЛАВНЫЙ СЦЕНАРИЙ ПАРСИНГА ===
    async function startParsing() {
        console.log("🚀 Парсер запущен...");

        console.log("⏳ Ждем отзывы...");
        const reviewsLoaded = await waitForReviewsToLoad();
        if (!reviewsLoaded) {
            alert("❌ Отзывы не загрузились. Проверьте интернет или страницу.");
            return;
        }
        await sleep(1000);
        await applySorting();

        let scrollContainer = document.querySelector('.scroll__container') || document.querySelector('.sidebar-view__panel');
        if (!scrollContainer) {
            const reviewsList = document.querySelector('.business-reviews-card-view__reviews-container');
            if (reviewsList) scrollContainer = reviewsList.parentElement;
        }
        if (!scrollContainer) { alert("❌ Контейнер не найден."); return; }

        console.log("⬇️ Скроллинг...");
        const CONFIG = { scrollCount: 50, scrollDelay: 1500 };
        let previousHeight = 0;
        for (let i = 0; i < CONFIG.scrollCount; i++) { 
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            await sleep(CONFIG.scrollDelay);
            if (scrollContainer.scrollHeight === previousHeight) break;
            previousHeight = scrollContainer.scrollHeight;
        }

        const expandButtons = document.querySelectorAll('[class*="review-view__expand"]');
        if (expandButtons.length) { expandButtons.forEach(btn => btn.click()); await sleep(2500); }

        const cards = document.querySelectorAll('.business-review-view');
        const reviews = [];
        cards.forEach((card) => {
            const name = card.querySelector('.business-review-view__author-name')?.innerText.trim() || "Аноним";
            const date = card.querySelector('.business-review-view__date')?.innerText.trim() || "";
            let rating = "Нет оценки";
            const metaRating = card.querySelector('meta[itemprop="ratingValue"]');
            if (metaRating) rating = metaRating.getAttribute('content');
            else {
                const badge = card.querySelector('.business-rating-badge-view__rating-text');
                if (badge) rating = badge.innerText.trim();
            }
            let text = "";
            const textSelectors = ['.business-review-view__body-text', '[class*="body-text"]', '.business-review-view__text'];
            for (const selector of textSelectors) {
                const el = card.querySelector(selector);
                if (el && el.innerText.trim().length > 0) {
                    text = el.innerText.trim();
                    break;
                }
            }
            if (!text && name) {
                 const bodyContainer = card.querySelector('.business-review-view__body');
                 if (bodyContainer) text = bodyContainer.innerText.trim();
            }
            reviews.push({ name, date, rating, text });
        });

        const h1El = document.querySelector('h1');
        let businessName = h1El ? h1El.innerText.trim().replace(/[/\\?%*:|"<>]/g, '_') : "reviews";
        const csvContent = "Имя;Дата;Оценка;Отзыв\n" + reviews.map(e => `"${e.name}";"${e.date}";"${e.rating}";"${(e.text || "").replace(/"/g, '""').replace(/\n/g, " ")}"`).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const fileName = `${businessName}_reviews_${new Date().toISOString().slice(0,10)}.csv`;
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccessPopup(reviews.length, fileName);
    }

    // === ЛОГИКА ЗАПУСКА ===

    // 1. АВТОЗАПУСК ПОСЛЕ РЕДИРЕКТА
    if (sessionStorage.getItem('yandexParserAutoRun') === 'true') {
        sessionStorage.removeItem('yandexParserAutoRun');
        console.log("🔄 Автозапуск...");
        // Если мы на отзывах - запускаем, иначе ничего не делаем
        if (window.location.href.includes('/reviews')) {
            setTimeout(() => startParsing(), 2000);
        }
    }

    // 2. ОБРАБОТКА НАЖАТИЯ КНОПКИ
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "start") {
            const currentUrl = window.location.href;
            
            // Ищем ID в двух форматах
            const orgMatch = currentUrl.match(/\/maps\/org\/[^/]+\/(\d+)/);
            const poiMatch = currentUrl.match(/oid(?:=|%3D)(\d+)/);

            let targetId = null;
            if (orgMatch) targetId = orgMatch[1];
            else if (poiMatch) targetId = poiMatch[1];

            if (targetId) {
                // Если мы УЖЕ на странице отзывов и это не POI ссылка (которую лучше "раскрыть" через редирект для надежности)
                // То просто запускаем
                if (currentUrl.includes('/reviews') && !poiMatch) {
                    startParsing();
                } 
                else {
                    // АВТОМАТИЧЕСКИЙ РЕДИРЕКТ (БЕЗ ВОПРОСОВ)
                    console.log("📍 Найден ID организации, переходим к отзывам...");
                    sessionStorage.setItem('yandexParserAutoRun', 'true');
                    
                    // Строим ссылку через /temp/, Яндекс сам подставит имя
                    const targetUrl = `https://yandex.ru/maps/org/temp/${targetId}/reviews/`;
                    window.location.href = targetUrl;
                }
            } else {
                alert("Не удалось найти ID организации на этой странице.");
            }
        }
    });
})();