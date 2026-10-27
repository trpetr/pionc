// src/main.ts
import * as fuzz from 'fuzzball';

const canvas = document.createElement('canvas');
const container = document.getElementById('crt-container');
if (container) {
  container.appendChild(canvas);
} else {
  document.body.appendChild(canvas);
}
const ctx = canvas.getContext('2d')!;

// --- Конфигурация ---
const CELL_WIDTH = 16;
const CELL_HEIGHT = 24;
const FONT = '20px "Courier New", monospace';

// --- Состояние ---
let cursor = { col: 0, row: 0 };
const grid = new Map<string, string>(); 

// Смещение камеры
let offsetX = 0;
let offsetY = 0;

// Масштаб (1 = 100%)
let scale = 1;

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
document.body.appendChild(input);

// --- Вспомогательные функции ---
function getCellKey(col: number, row: number) {
  return `${col},${row}`;
}

function writeTextToGrid(text: string, startCol: number, startRow: number) {
  let currentCol = startCol;
  let currentRow = startRow;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\n') {
      currentRow++;
      currentCol = startCol; 
      continue;
    }
    grid.set(getCellKey(currentCol, currentRow), char);
    currentCol++;
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
  img.onerror = () => console.error('Ошибка картинки:', url);
}

// --- Отрисовка ---
function draw() {
  // Очищаем фон (чтобы был виден CSS-градиент)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // 1. Рисуем картинки
  for (const imgData of images) {
    ctx.drawImage(imgData.img, imgData.x, imgData.y, imgData.width, imgData.height);
  }

  // 2. Рисуем текст
  ctx.font = FONT;
  ctx.fillStyle = '#ffffff'; // Белый текст
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Неоновое свечение для текста
  ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
  ctx.shadowBlur = 4;

  for (const [key, char] of grid.entries()) {
    const [col, row] = key.split(',').map(Number);
    const x = col * CELL_WIDTH + CELL_WIDTH / 2;
    const y = row * CELL_HEIGHT + CELL_HEIGHT / 2;
    ctx.fillText(char, x, y);
  }

  // Отключаем свечение для курсора
  ctx.shadowBlur = 0;

  // 3. Рисуем курсор
  const cursorX = cursor.col * CELL_WIDTH;
  const cursorY = cursor.row * CELL_HEIGHT;
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)'; // Голубой неоновый курсор
  ctx.lineWidth = 1 / scale; 
  ctx.strokeRect(cursorX, cursorY, CELL_WIDTH, CELL_HEIGHT);

  ctx.restore();
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
    const mouseX = (e.clientX - offsetX) / scale;
    const mouseY = (e.clientY - offsetY) / scale;
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
  if (e.button === 2) isPanning = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Обработка зума ---
canvas.addEventListener('wheel', (e) => {
  e.preventDefault(); 
  const zoomDirection = e.deltaY < 0 ? 1 : -1;
  const zoomFactor = 1.1; 
  const newScale = zoomDirection > 0 ? scale * zoomFactor : scale / zoomFactor;
  if (newScale < 0.1 || newScale > 5) return;

  const mouseX = e.clientX;
  const mouseY = e.clientY;
  offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
  offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
  scale = newScale;
  draw();
}, { passive: false });

// --- Пул команд и парсер ---
interface CommandData {
  target: string;      
  aliases: string[];   
}

const commandPool: Record<string, CommandData> = {
  'портфолио': { 
    target: '/portfolio.json', 
    aliases: ['работы', 'проекты', 'галерея', 'мои работы'] 
  },
  'привет': { 
    target: 'text:Привет! Это тестовый ответ.', 
    aliases: ['хай', 'здравствуй', 'приветствие'] 
  },
};

function parseCommand(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  for (const [key, data] of Object.entries(commandPool)) {
    if (key === normalized || data.aliases.includes(normalized)) {
      return data.target;
    }
  }

  const allTerms: { term: string, target: string }[] = [];
  
  for (const [key, data] of Object.entries(commandPool)) {
    allTerms.push({ term: key, target: data.target });
    data.aliases.forEach(alias => allTerms.push({ term: alias, target: data.target }));
  }

  const availableTerms = allTerms.map(t => t.term);
  const results = fuzz.extract(normalized, availableTerms, { limit: 1, cutoff: 50 });

  if (results.length > 0) {
    const bestTerm = results[0][0] as string;
    const match = allTerms.find(t => t.term === bestTerm);
    if (match) {
      console.log(`🤔 Распознано как "${bestTerm}"`);
      return match.target;
    }
  }

  return null;
}

// --- Загрузка JSON-лейаута ---
async function loadLayout(jsonPath: string, startCol: number, startRow: number) {
  try {
    const response = await fetch(jsonPath);
    if (!response.ok) throw new Error('Файл не найден');
    
    const objects = await response.json();
    
    // Нормализация (чтобы лейаут не улетал вправо)
    let minCol = Infinity;
    let minRow = Infinity;
    
    objects.forEach((obj: any) => {
      if (obj.col < minCol) minCol = obj.col;
      if (obj.row < minRow) minRow = obj.row;
    });

    if (minCol === Infinity) return;

    objects.forEach((obj: any) => {
      const relativeCol = obj.col - minCol;
      const relativeRow = obj.row - minRow;

      const finalCol = startCol + relativeCol;
      // СДВИГ НА 1 КЛЕТКУ ВНИЗ (+1)
      const finalRow = startRow + relativeRow + 1;

      if (obj.type === 'text') {
        writeTextToGrid(obj.content, finalCol, finalRow);
      } else if (obj.type === 'image') {
        addImageToCanvas(obj.content, finalCol, finalRow, obj.width || 300);
      }
    });
    
    draw();
  } catch (error) {
    console.error('Ошибка загрузки лейаута:', error);
    writeTextToGrid(`[Ошибка загрузки ${jsonPath}]`, startCol, startRow);
    draw();
  }
}

// --- Обработка ввода с клавиатуры ---
input.addEventListener('keyup', async (e) => {
  if (['Enter', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
    e.preventDefault();
  }

  if (e.key === 'Enter') {
    let lineText = '';
    let firstCharCol = -1; 

    for (let c = 0; c < cursor.col; c++) {
      const char = grid.get(getCellKey(c, cursor.row)) || ' ';
      lineText += char;
      if (char !== ' ' && firstCharCol === -1) firstCharCol = c;
    }
    
    const command = lineText.trim();
    if (!command) {
      cursor.row += 1; 
      draw();
      return;
    }
    if (firstCharCol === -1) firstCharCol = 0;

    const startRow = cursor.row + 1;
    
    const result = parseCommand(command);
    
    if (result) {
      if (result.startsWith('text:')) {
        const textResponse = result.replace('text:', '');
        writeTextToGrid(textResponse, firstCharCol, startRow);
        cursor.row = startRow + textResponse.split('\n').length + 1;
      } else if (result.endsWith('.json')) {
        writeTextToGrid('Загрузка...', firstCharCol, startRow);
        draw();
        await loadLayout(result, firstCharCol, startRow);
        cursor.row = startRow + 30; 
      }
    } else {
      writeTextToGrid('Команда не найдена.', firstCharCol, startRow);
      cursor.row = startRow + 2;
    }
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

// Страховка для фокуса
window.addEventListener('keydown', (e) => {
  if (document.activeElement !== input && e.key !== 'F12') {
    input.focus();
  }
});

// --- Старт ---
resize();
input.focus();