document.addEventListener("DOMContentLoaded", function () {
  let allData = [];
  let correctPassword = null;
  let isAuthorized = false;

  const CAFE_CONFIG = {
    "Мельница": {
      className: "melnitsa",
      displayName: "«Мельница»"
    },
    "Бочка": {
      className: "bochka",
      displayName: "«Бочка»"
    },
    "Гран Буфет": {
      className: "bufet",
      displayName: "«Гран Буфет»"
    }
  };

  // Элементы интерфейса
  const passwordModal = document.getElementById("passwordModal");
  const modalCard = document.getElementById("modalCard");
  const passwordInput = document.getElementById("passwordInput");
  const modalError = document.getElementById("modalError");
  const modalErrorText = document.getElementById("modalErrorText");
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const resultDiv = document.getElementById("result");

  // Нормализация строки: нижний регистр, замена «ё» на «е», удаление лишних концевых пробелов
  function normalize(str) {
    if (!str) return "";
    return str.toString().toLowerCase().replace(/ё/g, "е").trim();
  }

  // Токенизация ФИО на отдельные слова
  function tokenizeName(fullName) {
    if (!fullName) return [];
    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .map(w => normalize(w));
  }

  // Функция для загрузки пароля из файла password.xls
  async function loadPassword() {
    try {
      const response = await fetch("password.xls");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      return data[0]?.[0]?.toString().trim() || null;
    } catch (error) {
      console.error("Ошибка при загрузке пароля:", error);
      return null;
    }
  }

  // Показ модального окна пароля
  function promptPasswordModal() {
    return new Promise((resolve) => {
      passwordModal.classList.add("active");
      passwordInput.value = "";
      modalError.style.display = "none";
      setTimeout(() => passwordInput.focus(), 150);

      window.handlePasswordSubmit = function (e) {
        if (e) e.preventDefault();
        const userInput = passwordInput.value.trim();

        if (userInput === correctPassword) {
          passwordModal.classList.remove("active");
          modalError.style.display = "none";
          isAuthorized = true;
          resolve(true);
        } else {
          modalError.style.display = "flex";
          modalErrorText.textContent = "Неверный пароль. Попробуйте снова.";
          modalCard.classList.remove("shake");
          void modalCard.offsetWidth;
          modalCard.classList.add("shake");
          passwordInput.value = "";
          passwordInput.focus();
        }
      };
    });
  }

  // Проверка пароля
  async function checkPassword() {
    correctPassword = await loadPassword();

    if (!correctPassword) {
      const isFileProtocol = window.location.protocol === "file:";
      const tipMsg = isFileProtocol 
        ? "Не удалось загрузить пароль из-за ограничений браузера (file://). Запустите сайт через локальный сервер или GitHub Pages."
        : "Не удалось загрузить пароль. Пожалуйста, обратитесь к управляющему.";

      modalError.style.display = "flex";
      modalErrorText.textContent = tipMsg;
      passwordModal.classList.add("active");
      console.warn("Пароль не загружен:", tipMsg);
      return false;
    }

    return await promptPasswordModal();
  }

  // Переключение видимости пароля
  window.togglePasswordVisibility = function () {
    const isPass = passwordInput.getAttribute("type") === "password";
    passwordInput.setAttribute("type", isPass ? "text" : "password");
    const eyeIcon = document.getElementById("eyeIcon");
    if (eyeIcon) {
      eyeIcon.innerHTML = isPass
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
  };

  // Загрузка и обработка одного файла Excel
  async function loadAndProcessExcel(fileUrl, cafeName) {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        console.warn(`Файл ${fileUrl} не найден (${response.status})`);
        return [];
      }
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      return data.map(row => {
        if (!row || !row[0]) return null;

        const rawName = row[0]?.toString().trim();
        let id = "";
        let fullName = "";

        if (cafeName === "Мельница") {
          // Формат: м0001.Еремин Михаил    20
          id = rawName.split(".")[0]?.replace(/\D/g, "") || "";
          fullName = rawName.split(".").slice(1).join(".").trim();
        } else {
          // Формат: 5.2371.ЖЕГАНОВА ЯНА ЕВГЕНЬЕВНА    10
          id = rawName.split(".")[1]?.replace(/\D/g, "") || "";
          fullName = rawName.split(".").slice(2).join(".").trim();
        }

        const discountRaw = typeof row[1] === "number" ? row[1].toString() : (row[1]?.toString().trim() || "Размер скидки не указан");

        // Предвычисление нормализованного номера карты и номера без ведущих нулей
        const idLower = normalize(id);
        const idNoZeros = idLower.replace(/^0+/, "");

        return {
          cafe: cafeName,
          id,
          idLower,
          idNoZeros,
          fullName,
          discount: discountRaw,
          tokens: tokenizeName(fullName)
        };
      }).filter(item => item && (item.id || item.fullName));
    } catch (error) {
      console.error(`Ошибка при загрузке ${fileUrl}:`, error);
      return [];
    }
  }

  // Экранирование HTML
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Подсветка найденных слов и префиксов в ФИО
  function highlightGuestName(fullName, completedWords, incompleteWord) {
    if (!fullName) return "";
    if ((!completedWords || !completedWords.length) && !incompleteWord) {
      return escapeHtml(fullName);
    }

    const parts = fullName.split(/(\s+)/);
    return parts.map(part => {
      if (/^\s+$/.test(part)) return part;
      const normPart = normalize(part);

      // Проверяем точное совпадение со словом
      if (completedWords && completedWords.includes(normPart)) {
        return `<mark>${escapeHtml(part)}</mark>`;
      }

      // Проверяем префиксное совпадение
      if (incompleteWord && normPart.startsWith(incompleteWord)) {
        const matchLen = incompleteWord.length;
        const matchPrefix = part.substring(0, matchLen);
        const rest = part.substring(matchLen);
        return `<mark>${escapeHtml(matchPrefix)}</mark>${escapeHtml(rest)}`;
      }

      return escapeHtml(part);
    }).join("");
  }

  // Форматирование скидки для значка
  function formatDiscount(discountStr) {
    if (!discountStr) return "0%";
    const trimmed = discountStr.toString().trim();
    if (/^\d+$/.test(trimmed)) {
      return `${trimmed}%`;
    }
    return trimmed;
  }

  // Генерация HTML разметки для одной карточки
  function buildCardHtml(match, className, completedWords, incompleteWord) {
    const formattedDiscount = formatDiscount(match.discount);
    const highlightedName = highlightGuestName(match.fullName, completedWords, incompleteWord);

    return `
      <li class="discount-item">
        <div class="guest-info">
          <span class="guest-name">${highlightedName}</span>
          <div class="card-number-badge">
            <span class="card-number-prefix">КАРТА</span>
            <span>№ ${escapeHtml(match.id)}</span>
          </div>
        </div>
        <div class="discount-value-pill">
          <span class="discount-badge ${className}">${escapeHtml(formattedDiscount)}</span>
        </div>
      </li>
    `;
  }

  // Очистка поиска
  window.clearSearch = function () {
    searchInput.value = "";
    if (clearSearchBtn) clearSearchBtn.style.display = "none";
    if (window.searchDiscount) {
      window.searchDiscount(true);
    }
    searchInput.focus();
  };

  // Быстрая установка запроса по клику на пример
  window.setQuery = function (val) {
    searchInput.value = val;
    if (window.searchDiscount) {
      window.searchDiscount(true);
    }
    searchInput.focus();
  };

  // Основная логика инициализации
  (async function () {
    const isPasswordCorrect = await checkPassword();

    if (!isPasswordCorrect) {
      return;
    }

    // Загрузка данных из всех трёх файлов
    Promise.all([
      loadAndProcessExcel("dataMelnitsa.xls", "Мельница"),
      loadAndProcessExcel("dataBochka.xls", "Бочка"),
      loadAndProcessExcel("dataBufet.xls", "Гран Буфет")
    ])
      .then(results => {
        allData = [].concat(...results);

        // Автофокус в поле поиска
        setTimeout(() => searchInput.focus(), 100);

        // Управление поиском, подгрузкой и наблюдателем
        let searchDebounceTimer = null;
        let activeObserver = null;
        let lastQuerySignature = "";
        let activeSearchState = null;
        const DEBOUNCE_DELAY = 120;
        const PER_CAFE_INITIAL = 30;
        const PER_CAFE_BATCH = 30;

        function cleanupObserver() {
          if (activeObserver) {
            activeObserver.disconnect();
            activeObserver = null;
          }
        }

        // Плавная догрузка следующей порции карточек для конкретного заведения
        function loadMoreForCafe(cafe, boxEl) {
          if (!activeSearchState || !activeSearchState.groupedResults || !activeSearchState.groupedResults[cafe]) {
            return;
          }
          const items = activeSearchState.groupedResults[cafe];
          const config = CAFE_CONFIG[cafe] || { className: "melnitsa" };
          const currentLoaded = parseInt(boxEl.getAttribute("data-loaded"), 10) || PER_CAFE_INITIAL;

          if (currentLoaded >= items.length) {
            if (activeObserver) activeObserver.unobserve(boxEl);
            boxEl.remove();
            return;
          }

          const nextLoaded = Math.min(currentLoaded + PER_CAFE_BATCH, items.length);
          const nextItems = items.slice(currentLoaded, nextLoaded);

          const targetUl = resultDiv.querySelector(`.discount-list[data-cafe="${escapeHtml(cafe)}"]`);
          if (targetUl && nextItems.length > 0) {
            let chunkHtml = "";
            for (let i = 0; i < nextItems.length; i++) {
              chunkHtml += buildCardHtml(
                nextItems[i],
                config.className,
                activeSearchState.completedWords,
                activeSearchState.incompleteWord
              );
            }
            targetUl.insertAdjacentHTML("beforeend", chunkHtml);
          }

          boxEl.setAttribute("data-loaded", nextLoaded);
          const remaining = items.length - nextLoaded;
          if (remaining <= 0) {
            if (activeObserver) activeObserver.unobserve(boxEl);
            boxEl.remove();
          } else {
            const btnSpan = boxEl.querySelector(".cafe-more-btn span");
            if (btnSpan) {
              btnSpan.textContent = `Показать ещё (осталось ${remaining})`;
            }
          }
        }

        // Функция фактического поиска и мгновенной отрисовки
        function executeSearch() {
          cleanupObserver();

          const rawValue = searchInput ? searchInput.value : "";

          if (!rawValue || !rawValue.trim()) {
            lastQuerySignature = "";
            activeSearchState = null;
            resultDiv.innerHTML = `
              <div class="state-box">
                <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <div class="state-title">Быстрый поиск скидки</div>
                <div class="state-desc">Начните вводить фамилию гостя или номер скидочной карты в поле выше</div>
              </div>
            `;
            return;
          }

          // Определение режима поиска по наличию пробела и позиции курсора
          const cursorPos = (searchInput.selectionStart !== null && searchInput.selectionStart !== undefined)
            ? searchInput.selectionStart
            : rawValue.length;

          const textBeforeCursor = rawValue.substring(0, cursorPos);
          const textAfterCursor = rawValue.substring(cursorPos);

          const hasTrailingSpace = /\s$/.test(textBeforeCursor);
          const tokensBefore = textBeforeCursor.trim().split(/\s+/).filter(Boolean);
          const tokensAfter = textAfterCursor.trim().split(/\s+/).filter(Boolean);

          let completedWords = [];
          let incompleteWord = "";

          if (hasTrailingSpace) {
            completedWords = tokensBefore.map(w => normalize(w));
            incompleteWord = "";
          } else {
            if (tokensBefore.length > 0) {
              completedWords = tokensBefore.slice(0, -1).map(w => normalize(w));
              incompleteWord = normalize(tokensBefore[tokensBefore.length - 1]);
            }
          }

          if (tokensAfter.length > 0) {
            completedWords = completedWords.concat(tokensAfter.map(w => normalize(w)));
          }

          // Поиск по номеру карты (для чисел без пробелов)
          const trimmedRaw = rawValue.trim();
          const trimmedLower = normalize(trimmedRaw);
          const trimmedNoZeros = trimmedLower.replace(/^0+/, "");

          const querySignature = `${trimmedLower}::${cursorPos}::${completedWords.join(",")}::${incompleteWord}`;
          if (querySignature === lastQuerySignature) {
            return;
          }
          lastQuerySignature = querySignature;

          const matches = allData.filter(item => {
            // 1. Проверка по номеру карты с использованием предвычисленных значений
            const isIdMatch = (item.idLower === trimmedLower) || (trimmedNoZeros.length > 0 && item.idNoZeros === trimmedNoZeros);
            if (isIdMatch) return true;

            // 2. Проверка по ФИО (пословный точный + префиксный поиск)
            if (!item.tokens || item.tokens.length === 0) return false;
            if (completedWords.length === 0 && !incompleteWord) return false;

            const remainingTokens = [...item.tokens];

            for (const cWord of completedWords) {
              const matchIdx = remainingTokens.indexOf(cWord);
              if (matchIdx === -1) {
                return false;
              }
              remainingTokens.splice(matchIdx, 1);
            }

            if (incompleteWord) {
              const prefixFound = remainingTokens.some(gWord => gWord.startsWith(incompleteWord));
              if (!prefixFound) {
                return false;
              }
            }

            return true;
          });

          if (matches.length > 0) {
            // Группировка результатов по заведениям
            const groupedResults = {};
            for (let i = 0; i < matches.length; i++) {
              const match = matches[i];
              if (!groupedResults[match.cafe]) {
                groupedResults[match.cafe] = [];
              }
              groupedResults[match.cafe].push(match);
            }

            activeSearchState = {
              groupedResults,
              completedWords,
              incompleteWord
            };

            let outputHtml = `
              <div class="results-meta">
                <span class="results-count">Найдено скидок: ${matches.length}</span>
              </div>
            `;

            for (const cafe in groupedResults) {
              const config = CAFE_CONFIG[cafe] || {
                className: "melnitsa",
                displayName: `«${cafe}»`
              };
              const items = groupedResults[cafe];
              const initialSlice = items.slice(0, PER_CAFE_INITIAL);

              let cardsHtml = "";
              for (let i = 0; i < initialSlice.length; i++) {
                cardsHtml += buildCardHtml(initialSlice[i], config.className, completedWords, incompleteWord);
              }

              let moreBoxHtml = "";
              if (items.length > PER_CAFE_INITIAL) {
                const remaining = items.length - PER_CAFE_INITIAL;
                moreBoxHtml = `
                  <div class="cafe-more-box" data-cafe="${escapeHtml(cafe)}" data-loaded="${PER_CAFE_INITIAL}">
                    <button type="button" class="cafe-more-btn">
                      <span>Показать ещё (осталось ${remaining})</span>
                    </button>
                  </div>
                `;
              }

              outputHtml += `
                <section class="cafe-group">
                  <div class="cafe-header ${config.className}">
                    <h3 class="cafe-title">${escapeHtml(config.displayName)}</h3>
                    <span class="cafe-count-badge">${items.length} ${items.length === 1 ? 'карта' : (items.length < 5 ? 'карты' : 'карт')}</span>
                  </div>
                  <ul class="discount-list" data-cafe="${escapeHtml(cafe)}">
                    ${cardsHtml}
                  </ul>
                  ${moreBoxHtml}
                </section>
              `;
            }

            resultDiv.innerHTML = outputHtml;

            // Вешаем обработчики кликов и IntersectionObserver для плавной догрузки
            const moreBoxes = resultDiv.querySelectorAll(".cafe-more-box");
            if (moreBoxes.length > 0) {
              moreBoxes.forEach(boxEl => {
                const cafe = boxEl.getAttribute("data-cafe");
                boxEl.addEventListener("click", () => loadMoreForCafe(cafe, boxEl));
              });

              if ("IntersectionObserver" in window) {
                activeObserver = new IntersectionObserver((entries) => {
                  entries.forEach(entry => {
                    if (entry.isIntersecting) {
                      const boxEl = entry.target;
                      const cafe = boxEl.getAttribute("data-cafe");
                      loadMoreForCafe(cafe, boxEl);
                    }
                  });
                }, { rootMargin: "350px 0px" });

                moreBoxes.forEach(boxEl => activeObserver.observe(boxEl));
              }
            }
          } else {
            activeSearchState = null;
            resultDiv.innerHTML = `
              <div class="state-box">
                <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div class="state-title">Ничего не найдено</div>
                <div class="state-desc">По запросу «${escapeHtml(rawValue.trim())}» скидочные карты не найдены.<br>Проверьте номер карты или фамилию гостя.</div>
              </div>
            `;
          }
        }

        // Функция поиска с поддержкой debounce
        window.searchDiscount = function (immediate = false) {
          if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
          }

          const rawValue = searchInput ? searchInput.value : "";

          // Показ / скрытие кнопки очистки
          if (clearSearchBtn) {
            clearSearchBtn.style.display = rawValue.length > 0 ? "inline-flex" : "none";
          }

          // При очистке поля (пустое значение) или флаге immediate поиск выполняется сразу
          if (immediate === true || !rawValue || !rawValue.trim()) {
            executeSearch();
            return;
          }

          searchDebounceTimer = setTimeout(executeSearch, DEBOUNCE_DELAY);
        };

        // Подписка на изменение позиции курсора стрелками
        searchInput.addEventListener("keyup", function (e) {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            window.searchDiscount(true);
          }
        });
        searchInput.addEventListener("click", function () {
          window.searchDiscount(true);
        });

        if (searchInput.value.trim()) {
          window.searchDiscount(true);
        }
      })
      .catch(error => {
        console.error("Ошибка при загрузке данных:", error);
      });
  })();

  // Сворачивание клавиатуры при тапе / клике вне поля ввода
  function handleDismissKeyboard(e) {
    if (document.activeElement === searchInput) {
      if (
        e.target !== searchInput &&
        !e.target.closest("#clearSearchBtn") &&
        !e.target.closest(".example-tag") &&
        !e.target.closest(".cafe-more-btn") &&
        !e.target.closest(".cafe-more-box")
      ) {
        searchInput.blur();
      }
    }
  }

  document.addEventListener("touchstart", handleDismissKeyboard, { passive: true });
  document.addEventListener("mousedown", handleDismissKeyboard);

  // Горячая клавиша Escape для очистки поиска
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isAuthorized) {
      window.clearSearch();
    }
  });
});
