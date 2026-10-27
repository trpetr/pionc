// src/search.ts
import { purili } from '@purili/web-search';

export async function performWebSearch(query: string): Promise<string | null> {
  try {
    // Официальный клиент, который должен корректно работать с CORS
    const response = await purili.search(query);
    
    if (response && response.results && response.results.length > 0) {
      let responseText = `🌐 Результаты поиска по запросу "${query}":\n\n`;
      
      response.results.slice(0, 3).forEach((res: any, index: number) => {
        responseText += `${index + 1}. ${res.title || 'Без названия'}\n`;
        if (res.snippet) {
          responseText += `${res.snippet}\n`;
        }
        if (res.url) {
          responseText += `Ссылка: ${res.url}\n`;
        }
        responseText += `\n`;
      });

      return responseText;
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка веб-поиска:', error);
    return `⚠️ Ошибка поиска: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}.`;
  }
}