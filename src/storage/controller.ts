import {
  buildWhatsAppUrl,
  confirmHandoff,
  nextGuest,
  parseBackup,
  prepareHandoff,
  serializeBackup,
  type AppState,
} from "../domain";
export interface Repository {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}
export interface HandoffPort {
  open(url: string): Promise<void>;
  id(): string;
  now(): string;
}
/** Single writer. Never optimistically announces persistence or external delivery. */
export class EventController {
  state: AppState | null = null;
  busy = false;
  constructor(
    private repository: Repository,
    private port: HandoffPort,
    private changed: (state: AppState | null) => void = () => {},
  ) {}
  async load() {
    this.state = await this.repository.load();
    this.changed(this.state);
    return this.state;
  }
  private async commit(state: AppState) {
    parseBackup(serializeBackup(state));
    await this.repository.save(state);
    this.state = state;
    this.changed(state);
  }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy)
      throw new Error("Please wait for the current action to finish.");
    this.busy = true;
    try {
      return await operation();
    } finally {
      this.busy = false;
    }
  }
  async update(transform: (state: AppState | null) => AppState) {
    return this.exclusive(() => this.commit(transform(this.state)));
  }
  async clear() {
    return this.exclusive(async () => {
      await this.repository.clear();
      this.state = null;
      this.changed(null);
    });
  }
  private async launch(guestId: string) {
    if (!this.state) throw new Error("Create an invitation first.");
    const state = prepareHandoff(
      this.state,
      guestId,
      this.port.id(),
      this.port.now(),
    );
    await this.commit(state);
    const pending = state.pendingHandoff!;
    await this.port.open(
      buildWhatsAppUrl(pending.recipient, pending.preparedMessage),
    );
  }
  async openGuest(guestId: string) {
    return this.exclusive(() => this.launch(guestId));
  }
  async retry(attemptId: string) {
    return this.exclusive(async () => {
      const pending = this.state?.pendingHandoff;
      if (!pending || pending.id !== attemptId)
        throw new Error("This invitation attempt has changed.");
      await this.port.open(
        buildWhatsAppUrl(pending.recipient, pending.preparedMessage),
      );
    });
  }
  async confirmAndNext(attemptId: string) {
    return this.exclusive(async () => {
      if (!this.state || this.state.pendingHandoff?.id !== attemptId)
        throw new Error("This invitation attempt has changed.");
      await this.commit(confirmHandoff(this.state, this.port.now(), attemptId));
      const guest = nextGuest(this.state!);
      if (guest) await this.launch(guest.id);
    });
  }
}
