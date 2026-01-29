/**
 * Zotero Translation Server 客户端
 * 用于通过 DOI/ISBN/PMID/arXiv ID 获取文献元数据
 */

import type { ZoteroItemData } from './types.js';

const DEFAULT_TRANSLATION_SERVER_URL = 'http://localhost:1969';

export class TranslationClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || DEFAULT_TRANSLATION_SERVER_URL;
  }

  /**
   * 通过标识符搜索文献元数据
   * 支持 DOI、ISBN、PMID、arXiv ID
   */
  async search(identifier: string): Promise<ZoteroItemData[]> {
    const url = `${this.baseUrl}/search`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: identifier,
      });

      if (response.status === 501) {
        throw new Error(`No translator found for identifier: ${identifier}`);
      }

      if (response.status === 500) {
        throw new Error(`Translation server error processing: ${identifier}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Translation server error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data as ZoteroItemData[];
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Cannot connect to Translation Server at ${this.baseUrl}. ` +
          `Please ensure it is running: docker run -d -p 1969:1969 zotero/translation-server`
        );
      }
      throw error;
    }
  }

  /**
   * 检查 Translation Server 是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
      });
      return response.ok || response.status === 404;
    } catch {
      return false;
    }
  }
}
