/**
 * 简单依赖注入容器
 */

type Factory<T> = () => T

class ServiceContainer {
  private services = new Map<string, Factory<unknown>>()
  private singletons = new Map<string, unknown>()

  register<T>(key: string, factory: Factory<T>, singleton = true): void {
    this.services.set(key, factory)
    if (!singleton) {
      this.singletons.delete(key)
    }
  }

  resolve<T>(key: string): T {
    const factory = this.services.get(key)
    if (!factory) {
      throw new Error(`Service not registered: ${key}`)
    }

    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T
    }

    const instance = factory() as T
    this.singletons.set(key, instance)
    return instance
  }

  has(key: string): boolean {
    return this.services.has(key)
  }
}

export const container = new ServiceContainer()
