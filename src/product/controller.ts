import type { ProductPreferences } from "./preferences";
export interface PreferencesPort {
  load(): Promise<ProductPreferences>;
  save(value: ProductPreferences): Promise<void>;
}
/** Serializes the entire read-transform-save transaction, not just the SQL write. */
export class PreferencesController {
  current: ProductPreferences | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private port: PreferencesPort,
    private changed: (value: ProductPreferences) => void = () => {},
  ) {}
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(action);
    this.queue = pending.catch(() => {});
    return pending;
  }
  load() {
    return this.enqueue(async () => {
      const value = await this.port.load();
      this.current = value;
      this.changed(value);
      return value;
    });
  }
  replace(value: ProductPreferences) {
    return this.enqueue(async () => {
      await this.port.save(value);
      this.current = value;
      this.changed(value);
      return value;
    });
  }
  update(transform: (value: ProductPreferences) => ProductPreferences) {
    return this.enqueue(async () => {
      if (!this.current)
        throw Error(
          "App preferences are unavailable. Retry in Settings. Your event is safe.",
        );
      const next = transform(this.current);
      await this.port.save(next);
      this.current = next;
      this.changed(next);
      return next;
    });
  }
}
