document.addEventListener("DOMContentLoaded", function () {
  let allData = [];

  // Функция для загрузки и обработки одного файла Excel
  async function loadAndProcessExcel(fileUrl, cafeName) {
    try {
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Обработка данных в зависимости от формата файла
      return data.map(row => {
        if (!row[0]) return null; // Пропускаем пустые строки

        const rawName = row[0]?.trim();
        let id, fullName;

        if (cafeName === "Мельница") {
          // Формат: м0001.Еремин Михаил	20
          id = rawName.split(".")[0]?.replace(/\D/g, ""); // Извлекаем номер скидки
          fullName = rawName.split(".").slice(1).join(".").trim(); // Извлекаем фамилию
        } else {
          // Формат: 5.2371.ЖЕГАНОВА ЯНА ЕВГЕНЬЕВНА	10
          id = rawName.split(".")[1]?.replace(/\D/g, ""); // Извлекаем номер скидки после первой точки
          fullName = rawName.split(".").slice(2).join(".").trim(); // Извлекаем фамилию после второй точки
        }

        const discount = typeof row[1] === "number" ? row[1].toString() : row[1]?.trim() || "Размер скидки не указан";

        return { cafe: cafeName, id, fullName, discount };
      }).filter(item => item); // Убираем пустые записи
    } catch (error) {
      console.error(`Ошибка при загрузке ${fileUrl}:`, error);
      return [];
    }
  }

  // Загрузка данных из всех файлов
  Promise.all([
    loadAndProcessExcel("dataMelnitsa.xlsx", "Мельница"),
    loadAndProcessExcel("dataBochka.xlsx", "Бочка"),
    loadAndProcessExcel("dataBufet.xlsx", "Буфет")
  ])
    .then(results => {
      allData = [].concat(...results); // Объединяем все данные
      console.log("Обработанные данные:", allData);

      // Функция поиска
      window.searchDiscount = function () {
        const input = document.getElementById("searchInput").value.trim().toLowerCase();
        const resultDiv = document.getElementById("result");

        if (!input) {
          resultDiv.innerHTML = "";
          return;
        }

        // Поиск по фамилии или номеру скидки (точное совпадение)
        const matches = allData.filter(item =>
          (item.id && item.id.toLowerCase() === input) || // Точное совпадение по ID
          (item.fullName && item.fullName.toLowerCase().includes(input)) // Поиск по фамилии
        );

        if (matches.length > 0) {
          // Группируем результаты по кафе
          const groupedResults = {};
          matches.forEach(match => {
            if (!groupedResults[match.cafe]) {
              groupedResults[match.cafe] = [];
            }
            groupedResults[match.cafe].push(match);
          });

          // Отображаем результаты с группировкой по кафе
          let outputHtml = "";
          for (const cafe in groupedResults) {
            outputHtml += `
              <h3>Найдено в кафе "${cafe}":</h3>
              <ul>
                ${groupedResults[cafe]
                  .map(match => `
                    <li>
                      <strong>Фамилия:</strong> ${match.fullName}<br>
                      <strong>Скидка:</strong> ${match.discount}<br>
                      <strong>Номер скидки:</strong> ${match.id}
                    </li>
                  `)
                  .join("")}
              </ul>
            `;
          }

          resultDiv.innerHTML = outputHtml;
        } else {
          resultDiv.innerHTML = "Ничего не найдено.";
        }
      };
    })
    .catch(error => console.error("Ошибка при загрузке данных:", error));
});
