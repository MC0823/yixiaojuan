/**
 * 白板数据LRU缓存
 * 只保留最近使用的N个题目的白板数据，避免内存堆积
 */

export class WhiteboardCache {
  private cache = new Map<number, string>()
  private maxSize: number

  constructor(maxSize = 10) {
    this.maxSize = maxSize
  }

  set(index: number, data: string): void {
    // 如果已存在，先删除（为了更新顺序）
    if (this.cache.has(index)) {
      this.cache.delete(index)
    }

    // 如果超过容量，删除最旧的（Map的第一个元素）
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(index, data)
  }

  get(index: number): string | undefined {
    const data = this.cache.get(index)
    if (data !== undefined) {
      // 更新访问顺序：删除后重新添加
      this.cache.delete(index)
      this.cache.set(index, data)
    }
    return data
  }

  has(index: number): boolean {
    return this.cache.has(index)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}
