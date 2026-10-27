// src/main.ts
import * as fuzz from 'fuzzball';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

// --- Конфигурация ---
const CELL_WIDTH = 16;
const CELL_HEIGHT = 24;
const FONT = '20px "Courier New", monospace';

// --- Состояние ---
let cursor = { col: 0, row: 0 };
const grid = new Map<string, string>(); 

// НОВОЕ: Смещение камеры (в пикселях)
let offsetX = 0;
let offsetY = 0;

// НОВОЕ: Состояние для перетаскивания (панорамирования)
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

// --- Скрытое поле для ввода ---
const input = document.createElement('input');
input.style.position = 'absolute';
input.style.opacity = '0';
input.style.left = '0';
input.style.top = '0';
input.style.width = '1px';
input.style.height = '1px';
// Добавляем это, чтобы браузер не блокировал фокус на невидимых элементах
input.setAttribute('autocomplete', 'off'); 
input.setAttribute('autocorrect', 'off');
input.setAttribute('autocapitalize', 'off');
input.setAttribute('spellcheck', 'false');
document.body.appendChild(input);

// --- Вспомогательные функции ---
function getCellKey(col: number, row: number) {
  return `${col},${row}`;
}

// НОВОЕ: Функция для записи текста в сетку начиная с определённой позиции
function writeTextToGrid(text: string, startCol: number, startRow: number) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      startRow++;
      startCol = 0; // Сброс на начало строки (упрощённо)
    } else {
      grid.set(getCellKey(startCol, startRow), text[i]);
      startCol++;
    }
  }
}

function draw() {
  // Очистка фона
  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = FONT;
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Рисование всех символов с учётом смещения
  for (const [key, char] of grid.entries()) {
    const [col, row] = key.split(',').map(Number);
    // Прибавляем offsetX и offsetY к координатам
    const x = col * CELL_WIDTH + CELL_WIDTH / 2 + offsetX;
    const y = row * CELL_HEIGHT + CELL_HEIGHT / 2 + offsetY;
    
    // Оптимизация: рисуем только то, что видно на экране
    if (x > -CELL_WIDTH && x < canvas.width + CELL_WIDTH && 
        y > -CELL_HEIGHT && y < canvas.height + CELL_HEIGHT) {
      ctx.fillText(char, x, y);
    }
  }

  // Рисование курсора с учётом смещения
  const cursorX = cursor.col * CELL_WIDTH + offsetX;
  const cursorY = cursor.row * CELL_HEIGHT + offsetY;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cursorX, cursorY, CELL_WIDTH, CELL_HEIGHT);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}
window.addEventListener('resize', resize);

// --- Обработка мыши (Клик и Панорамирование) ---

// 1. Нажатие мыши
// 1. Нажатие мыши
canvas.addEventListener('mousedown', (e) => {
  // Принудительно возвращаем фокус в поле ввода при каждом клике
  input.focus(); 
  
  if (e.button === 2) {
    // Правая кнопка: панорамирование
    isPanning = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  } else if (e.button === 0) {
    // Левая кнопка: ставим курсор
    const mouseX = e.clientX - offsetX;
    const mouseY = e.clientY - offsetY;

    cursor.col = Math.floor(mouseX / CELL_WIDTH);
    cursor.row = Math.floor(mouseY / CELL_HEIGHT);
    draw();
  }
});

// 2. Движение мыши
window.addEventListener('mousemove', (e) => {
  if (isPanning) {
    // Вычисляем разницу между текущим и предыдущим положением
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    
    // Сдвигаем камеру
    offsetX += dx;
    offsetY += dy;
    
    // Обновляем последнюю позицию
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    draw();
  }
});

// 3. Отпускание мыши
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) {
    isPanning = false;
  }
});

// Отключаем контекстное меню при клике правой кнопкой мыши
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Обработка ввода с клавиатуры ---
input.addEventListener('keyup', (e) => {
  if (['Enter', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
    e.preventDefault();
  }

  if (e.key === 'Enter') {
    let lineText = '';
    for (let c = 0; c < cursor.col; c++) {
      lineText += grid.get(getCellKey(c, cursor.row)) || ' ';
    }
    const command = lineText.trim();
    
    const result = parseCommand(command);
    
    if (result) {
      console.log('✅ Команда найдена:', command);
      
      // НОВОЕ: Отрисовка результата на холсте прямо под текущей строкой
      const startCol = 0;
      const startRow = cursor.row + 1; 
      
      // Временно упростим: рисуем payload как обычный текст
      // В идеале для 'html' нужно использовать другой подход, но для теста сойдёт
      writeTextToGrid(result.payload, startCol, startRow);
      
      // Сдвигаем курсор вниз, чтобы он не накладывался на ответ
      // (примитивная логика, позже улучшим)
      cursor.row = startRow + result.payload.split('\n').length + 1;
      
    } else {
      console.log('❌ Команда не найдена:', command);
      writeTextToGrid('Команда не найдена...', 0, cursor.row + 1);
      cursor.row += 2;
    }

    cursor.col = 0;
    
  } else if (e.key === 'Backspace') {
    if (cursor.col > 0) {
      cursor.col -= 1;
      grid.delete(getCellKey(cursor.col, cursor.row));
    }
  } else if (e.key.length === 1) {
    grid.set(getCellKey(cursor.col, cursor.row), e.key);
    cursor.col += 1;
  }
  
  draw();
});

// --- Парсер команд (без изменений) ---
interface CommandResponse {
  type: 'text' | 'image' | 'html';
  payload: string;
}

const commandPool: Record<string, CommandResponse> = {
  'привет': { type: 'text', payload: 'Привет, мир! Это тестовый ответ на холсте.' },
  'портфолио': { type: 'html', payload: 'Мое портфолио: Работа 1, Работа 2. (Тут будут картинки)' },
  'время': { type: 'text', payload: 'Текущее время: ' + new Date().toLocaleTimeString() },
};

function parseCommand(input: string): CommandResponse | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  // 1. Точное совпадение
  if (commandPool[normalized]) {
    return commandPool[normalized];
  }

  // 2. Нечёткий поиск через fuzzball
  const availableCommands = Object.keys(commandPool);
  
  // extract ищет лучшие совпадения. cutoff: 50 означает "схожесть не менее 50%"
  const results = fuzz.extract(normalized, availableCommands, {
    limit: 1, // Нам нужен только лучший вариант
    cutoff: 50 // Порог схожести в процентах (0-100). Можно поднять до 60-70 для строгости
  });

  if (results.length > 0) {
    const bestMatchKey = results[0][0] as string;
    console.log(`🤔 Вы имели в виду "${bestMatchKey}"?`);
    return commandPool[bestMatchKey];
  }

  return null;
}

// Страховка: если пользователь нажал на клавишу, а фокуса нет — возвращаем его
window.addEventListener('keydown', (e) => {
  // Если фокус не на поле ввода и это не клавиши DevTools (F12)
  if (document.activeElement !== input && e.key !== 'F12') {
    input.focus();
  }
});

// --- Старт ---
resize();
input.focus();