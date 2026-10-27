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

// Смещение камеры (в пикселях)
let offsetX = 0;
let offsetY = 0;

// Состояние для перетаскивания
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Массив для хранения картинок
interface CanvasImage {
  img: HTMLImageElement;
  x: number; 
  y: number; 
  width: number;
  height: number;
}
const images: CanvasImage[] = [];

// --- Скрытое поле для ввода ---
const input = document.createElement('input');
input.style.position = 'absolute';
input.style.opacity = '0';
input.style.left = '0';
input.style.top = '0';
input.style.width = '1px';
input.style.height = '1px';
input.setAttribute('autocomplete', 'off'); 
input.setAttribute('autocorrect', 'off');
input.setAttribute('autocapitalize', 'off');
input.setAttribute('spellcheck', 'false');
document.body.appendChild(input);

// --- Вспомогательные функции ---
function getCellKey(col: number, row: number) {
  return `${col},${row}`;
}

function writeTextToGrid(text: string, startCol: number, startRow: number) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      startRow++;
      startCol = 0;
    } else {
      grid.set(getCellKey(startCol, startRow), text[i]);
      startCol++;
    }
  }
}

function addImageToCanvas(url: string, startCol: number, startRow: number, width: number = 400) {
  const img = new Image();
  img.src = url;
  
  img.onload = () => {
    const aspectRatio = img.height / img.width;
    const height = width * aspectRatio;
    const x = startCol * CELL_WIDTH;
    const y = startRow * CELL_HEIGHT;
    images.push({ img, x, y, width, height });
    draw(); 
  };
  
  img.onerror = () => {
    console.error('Не удалось загрузить картинку:', url);
    writeTextToGrid('[Ошибка загрузки картинки]', startCol, startRow);
    draw();
  };
}

function draw() {
  // Очистка фона
  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Рисуем картинки (под текстом)
  for (const imgData of images) {
    const drawX = imgData.x + offsetX;
    const drawY = imgData.y + offsetY;
    if (drawX > -imgData.width && drawX < canvas.width && 
        drawY > -imgData.height && drawY < canvas.height) {
      ctx.drawImage(imgData.img, drawX, drawY, imgData.width, imgData.height);
    }
  }

  // 2. Рисуем текст
  ctx.font = FONT;
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const [key, char] of grid.entries()) {
    const [col, row] = key.split(',').map(Number);
    const x = col * CELL_WIDTH + CELL_WIDTH / 2 + offsetX;
    const y = row * CELL_HEIGHT + CELL_HEIGHT / 2 + offsetY;
    
    if (x > -CELL_WIDTH && x < canvas.width + CELL_WIDTH && 
        y > -CELL_HEIGHT && y < canvas.height + CELL_HEIGHT) {
      ctx.fillText(char, x, y);
    }
  }

  // 3. Рисуем курсор
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

// --- Обработка мыши ---
canvas.addEventListener('mousedown', (e) => {
  input.focus(); 
  
  if (e.button === 2) {
    isPanning = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  } else if (e.button === 0) {
    const mouseX = e.clientX - offsetX;
    const mouseY = e.clientY - offsetY;
    cursor.col = Math.floor(mouseX / CELL_WIDTH);
    cursor.row = Math.floor(mouseY / CELL_HEIGHT);
    draw();
  }
});

window.addEventListener('mousemove', (e) => {
  if (isPanning) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    offsetX += dx;
    offsetY += dy;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    draw();
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 2) {
    isPanning = false;
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Обработка ввода с клавиатуры ---
input.addEventListener('keyup', (e) => {
  if (['Enter', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
    e.preventDefault();
  }

  if (e.key === 'Enter') {
    let lineText = '';
    let firstCharCol = -1; 

    for (let c = 0; c < cursor.col; c++) {
      const char = grid.get(getCellKey(c, cursor.row)) || ' ';
      lineText += char;
      
      if (char !== ' ' && firstCharCol === -1) {
        firstCharCol = c;
      }
    }
    
    const command = lineText.trim();
    
    if (!command) {
      cursor.row += 1; // Если пустая строка, просто спускаемся на одну вниз
      draw();
      return;
    }

    if (firstCharCol === -1) firstCharCol = 0;

    const result = parseCommand(command);
    
    if (result) {
      console.log('✅ Команда найдена:', command);
      
      const startCol = firstCharCol; 
      const startRow = cursor.row + 1; 
      
      if (result.type === 'image') {
        addImageToCanvas(result.payload, startCol, startRow, 400); 
        cursor.row = startRow + 15; 
      } else {
        writeTextToGrid(result.payload, startCol, startRow);
        cursor.row = startRow + result.payload.split('\n').length + 1;
      }
      
    } else {
      console.log('❌ Команда не найдена:', command);
      writeTextToGrid('Команда не найдена...', firstCharCol, cursor.row + 1);
      cursor.row += 2;
    }

    // Убрали cursor.col = 0; — колонка остается на месте (в конце введенного слова)
    
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

// --- Парсер команд и LocalStorage ---
interface CommandResponse {
  type: 'text' | 'image' | 'html';
  payload: string;
}

const defaultCommands: Record<string, CommandResponse> = {
  'привет': { type: 'text', payload: 'Привет, мир! Это тестовый ответ на холсте.' },
  'портфолио': { type: 'html', payload: 'Мое портфолио: Работа 1, Работа 2. (Тут будут картинки)' },
  'время': { type: 'text', payload: 'Текущее время: ' + new Date().toLocaleTimeString() },
  'кот': { type: 'image', payload: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/800px-Cat03.jpg' }, 
};

let commandPool: Record<string, CommandResponse> = JSON.parse(
  localStorage.getItem('my_commands') || JSON.stringify(defaultCommands)
);

function saveCommandsToStorage() {
  localStorage.setItem('my_commands', JSON.stringify(commandPool));
}

function parseCommand(input: string): CommandResponse | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  if (commandPool[normalized]) {
    return commandPool[normalized];
  }

  const availableCommands = Object.keys(commandPool);
  
  const results = fuzz.extract(normalized, availableCommands, {
    limit: 1,
    cutoff: 50 
  });

  if (results.length > 0) {
    const bestMatchKey = results[0][0] as string;
    console.log(`🤔 Вы имели в виду "${bestMatchKey}"?`);
    return commandPool[bestMatchKey];
  }

  return null;
}

// --- Логика Панели Администратора ---
const adminPanel = document.getElementById('admin-panel')!;
const commandsList = document.getElementById('commands-list')!;
const addCommandBtn = document.getElementById('add-command-btn')!;
const closeAdminBtn = document.getElementById('close-admin-btn')!;

function renderAdminPanel() {
  commandsList.innerHTML = '';
  
  for (const [key, cmd] of Object.entries(commandPool)) {
    const div = document.createElement('div');
    div.className = 'command-item';
    
    div.innerHTML = `
      <input type="text" value="${key}" placeholder="Команда (без пробелов)" class="cmd-key" />
      <select class="cmd-type">
        <option value="text" ${cmd.type === 'text' ? 'selected' : ''}>Текст</option>
        <option value="image" ${cmd.type === 'image' ? 'selected' : ''}>Картинка (URL)</option>
      </select>
      <textarea class="cmd-payload" rows="2" placeholder="Ответ">${cmd.payload}</textarea>
      <button class="delete-btn" style="background:#f44336; color:white; border:none;">Удалить</button>
    `;

    const keyInput = div.querySelector('.cmd-key') as HTMLInputElement;
    const typeSelect = div.querySelector('.cmd-type') as HTMLSelectElement;
    const payloadInput = div.querySelector('.cmd-payload') as HTMLTextAreaElement;
    const deleteBtn = div.querySelector('.delete-btn') as HTMLButtonElement;

    keyInput.addEventListener('change', () => {
      const newKey = keyInput.value.trim().toLowerCase();
      if (newKey && newKey !== key) {
        commandPool[newKey] = commandPool[key];
        delete commandPool[key];
        saveCommandsToStorage();
        renderAdminPanel();
      }
    });

    typeSelect.addEventListener('change', () => {
      commandPool[key].type = typeSelect.value as 'text' | 'image';
      saveCommandsToStorage();
    });

    payloadInput.addEventListener('input', () => {
      commandPool[key].payload = payloadInput.value;
      saveCommandsToStorage();
    });

    deleteBtn.addEventListener('click', () => {
      delete commandPool[key];
      saveCommandsToStorage();
      renderAdminPanel();
    });

    commandsList.appendChild(div);
  }
}

addCommandBtn.addEventListener('click', () => {
  const newKey = prompt('Введите название команды (например, "обо мне"):');
  if (newKey) {
    const key = newKey.trim().toLowerCase();
    commandPool[key] = { type: 'text', payload: 'Новый ответ' };
    saveCommandsToStorage();
    renderAdminPanel();
  }
});

// Обработка Shift + A для открытия панели
window.addEventListener('keydown', (e) => {
  // Проверяем, что зажат Shift и нажата клавиша A
  if (e.shiftKey && e.code === 'KeyA') {
    e.preventDefault();
    
    if (adminPanel.style.display === 'block') {
      adminPanel.style.display = 'none';
      input.focus(); // Возвращаем фокус на холст при закрытии
    } else {
      adminPanel.style.display = 'block';
      renderAdminPanel();
    }
  }
});

closeAdminBtn.addEventListener('click', () => {
  adminPanel.style.display = 'none';
  input.focus();
});

// Страховка для фокуса
window.addEventListener('keydown', (e) => {
  if (document.activeElement !== input && e.key !== 'F12' && adminPanel.style.display !== 'block') {
    input.focus();
  }
});

// --- Старт ---
resize();
input.focus();