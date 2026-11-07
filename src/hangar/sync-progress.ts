import { SYNC_WORK } from '@/config';
import type { StorageId } from '@/storage/registry';

/** Progress of a full sync: pages for the counter, estimated work for the progress bar. */
export interface SyncProgress {
  /** Pages read so far. */
  done: number;
  /** Pages to read in total. */
  total: number;
  /** Share of the estimated work that is done, from 0 to 1 (see `SYNC_WORK`). */
  fraction: number;
  /** The storage read last, with its own pages (see `SyncProgressTracker.section`). */
  section?: { id: StorageId; done: number; total: number };
}

/** Where a sync announces and completes its pages (a tracker, or one section of it). */
export interface ProgressSink {
  expect(pages: number, work: number): void;
  complete(pages: number, work: number): void;
}

/** Estimated work of reading a list page with this many entries (see `SYNC_WORK`). */
export function listPageWork(entries: number): number {
  return SYNC_WORK.requestOverhead + entries;
}

/**
 * Counts the pages of a sync and their estimated work. Work is announced with `expect` as soon as
 * it is known and marked with `complete` when done; `onChange` hears about every change.
 *
 * After `start`, work announced later (e.g. detail pages found on the list pages) doesn't move the
 * bar back: it is spread over the part of the bar that is still empty.
 */
export class SyncProgressTracker {
  private pages = { done: 0, total: 0 };
  private work = { done: 0, total: 0 };
  private started = false;
  /** Fraction shown when work was last announced after `start`, and the work done by then. */
  private base = { fraction: 0, work: 0 };
  private sections = new Map<StorageId, { done: number; total: number }>();
  /** The section that completed pages last: the storage being read. */
  private active: StorageId | undefined;

  constructor(public onChange?: (progress: SyncProgress) => void) {}

  get progress(): SyncProgress {
    const remaining = this.work.total - this.base.work;
    const share = remaining > 0 ? (this.work.done - this.base.work) / remaining : 1;
    return {
      done: this.pages.done,
      total: this.pages.total,
      fraction: this.work.total ? this.base.fraction + (1 - this.base.fraction) * share : 0,
      ...(this.active && { section: { id: this.active, ...this.sections.get(this.active)! } }),
    };
  }

  /** The part of the sync that reads one storage: its pages count for it and for the whole. */
  section(id: StorageId): ProgressSink {
    const pages = { done: 0, total: 0 };
    this.sections.set(id, pages);
    return {
      expect: (count, work) => {
        pages.total += count;
        this.expect(count, work);
      },
      complete: (count, work) => {
        pages.done += count;
        this.active = id;
        this.complete(count, work);
      },
    };
  }

  /** Called once the work known up front is announced; see the class description. */
  start(): void {
    this.started = true;
  }

  /** Announces `pages` pages (or other steps, with 0 pages) still to do, with their work. */
  expect(pages: number, work: number): void {
    if (!pages && !work) return;
    if (this.started) this.base = { fraction: this.progress.fraction, work: this.work.done };
    this.pages.total += pages;
    this.work.total += work;
    this.onChange?.(this.progress);
  }

  /** Marks announced pages (or steps) as done, with the work announced for them. */
  complete(pages: number, work: number): void {
    this.pages.done += pages;
    this.work.done += work;
    this.onChange?.(this.progress);
  }
}
