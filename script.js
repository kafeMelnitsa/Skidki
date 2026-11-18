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
          sessionStorage.setItem("discount_auth", "true");
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

    if (sessionStorage.getItem("discount_auth") === "true") {
      isAuthorized = true;
      return true;
    }

    return await promptPasswordModal();
  }

  // Блокировка / Выход
  window.lockApp = function () {
    sessionStorage.removeItem("discount_auth");
    isAuthorized = false;
    passwordModal.classList.add("active");
    passwordInput.value = "";
    modalError.style.display = "none";
    setTimeout(() => passwordInput.focus(), 150);
  };

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

        return {
          cafe: cafeName,
          id,
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

  // Очистка поиска
  window.clearSearch = function () {
    searchInput.value = "";
    if (clearSearchBtn) clearSearchBtn.style.display = "none";
    window.searchDiscount();
    searchInput.focus();
  };

  // Быстрая установка запроса по клику на пример
  window.setQuery = function (val) {
    searchInput.value = val;
    window.searchDiscount();
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

        // Функция поиска с поддержкой префиксного и точного пословного поиска
        window.searchDiscount = function () {
          const rawValue = searchInput.value;

          // Показ / скрытие кнопки очистки
          if (clearSearchBtn) {
            clearSearchBtn.style.display = rawValue.length > 0 ? "inline-flex" : "none";
          }

          if (!rawValue || !rawValue.trim()) {
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
            // Режим точного поиска: после слова поставлен пробел.
            // Все слова до пробела считаются завершенными и ищутся строго целиком.
            completedWords = tokensBefore.map(w => normalize(w));
            incompleteWord = "";
          } else {
            // Режим префиксного поиска: курсор сразу после буквы без пробела.
            // Последнее слово перед курсором считается незавершенным (по маске слово*).
            if (tokensBefore.length > 0) {
              completedWords = tokensBefore.slice(0, -1).map(w => normalize(w));
              incompleteWord = normalize(tokensBefore[tokensBefore.length - 1]);
            }
          }

          // Если есть слова после курсора, они также участвуют как завершенные
          if (tokensAfter.length > 0) {
            completedWords = completedWords.concat(tokensAfter.map(w => normalize(w)));
          }

          // Поиск по номеру карты (для чисел без пробелов)
          const trimmedRaw = rawValue.trim();
          const trimmedLower = normalize(trimmedRaw);
          const trimmedNoZeros = trimmedLower.replace(/^0+/, "");

          const matches = allData.filter(item => {
            // 1. Проверка по номеру карты
            const idLower = normalize(item.id);
            const idNoZeros = idLower.replace(/^0+/, "");
            const isIdMatch = (idLower === trimmedLower) || (trimmedNoZeros.length > 0 && idNoZeros === trimmedNoZeros);
            if (isIdMatch) return true;

            // 2. Проверка по ФИО (пословный точный + префиксный поиск)
            if (!item.tokens || item.tokens.length === 0) return false;
            if (completedWords.length === 0 && !incompleteWord) return false;

            const remainingTokens = [...item.tokens];

            // Все completedWords должны строго совпадать с отдельными словами в ФИО
            for (const cWord of completedWords) {
              const matchIdx = remainingTokens.indexOf(cWord);
              if (matchIdx === -1) {
                return false;
              }
              remainingTokens.splice(matchIdx, 1);
            }

            // Если есть незавершенное слово, оно должно быть префиксом хотя бы одного из оставшихся слов ФИО
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
            matches.forEach(match => {
              if (!groupedResults[match.cafe]) {
                groupedResults[match.cafe] = [];
              }
              groupedResults[match.cafe].push(match);
            });

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

              outputHtml += `
                <section class="cafe-group">
                  <div class="cafe-header ${config.className}">
                    <h3 class="cafe-title">${escapeHtml(config.displayName)}</h3>
                    <span class="cafe-count-badge">${items.length} ${items.length === 1 ? 'карта' : (items.length < 5 ? 'карты' : 'карт')}</span>
                  </div>
                  <ul class="discount-list">
                    ${items.map(match => {
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
                            <span class="discount-badge ${config.className}">${escapeHtml(formattedDiscount)}</span>
                            <span class="discount-label">скидка</span>
                          </div>
                        </li>
                      `;
                    }).join("")}
                  </ul>
                </section>
              `;
            }

            resultDiv.innerHTML = outputHtml;
          } else {
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
        };

        // Подписка на изменение позиции курсора для динамического переключения режимов
        searchInput.addEventListener("keyup", function (e) {
          if (["ArrowLeft", "ArrowRight", "Home", "End", "Backspace", "Delete"].includes(e.key)) {
            window.searchDiscount();
          }
        });
        searchInput.addEventListener("click", window.searchDiscount);

        if (searchInput.value.trim()) {
          window.searchDiscount();
        }
      })
      .catch(error => {
        console.error("Ошибка при загрузке данных:", error);
      });
  })();

  // Горячая клавиша Escape для очистки поиска
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isAuthorized) {
      window.clearSearch();
    }
  });
});
