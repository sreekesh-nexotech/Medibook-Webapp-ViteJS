import type { Result } from '@/core/error/failure';

import type {
  Counter,
  CounterInput,
  DisplayDevice,
  DisplayDeviceChanges,
  DisplayDeviceWithKey,
  NumberingChanges,
  NumberingSeries,
  PrintPreview,
  PrintTemplate,
  PrintTemplateInput,
} from '@/features/settings/domain/entities/settings.entities';

/**
 * The hospital's admin configuration beyond the rulebook: numbering series,
 * front-desk counters, print templates and token display screens. Versioned
 * rows are written with the version the user saw (`If-Match`).
 */
export interface ConfigRepository {
  listNumbering(): Promise<Result<readonly NumberingSeries[]>>;
  updateNumbering(
    kind: string,
    changes: NumberingChanges,
    version: number,
  ): Promise<Result<NumberingSeries>>;
  /** The next number of the saved series; allocates nothing. */
  previewNumbering(kind: string): Promise<Result<string>>;

  listCounters(): Promise<Result<readonly Counter[]>>;
  createCounter(input: CounterInput): Promise<Result<Counter>>;
  updateCounter(
    id: string,
    changes: Partial<CounterInput>,
    version: number,
  ): Promise<Result<Counter>>;
  deleteCounter(id: string, version: number): Promise<Result<null>>;

  listPrintTemplates(): Promise<Result<readonly PrintTemplate[]>>;
  createPrintTemplate(input: PrintTemplateInput): Promise<Result<PrintTemplate>>;
  updatePrintTemplate(
    id: string,
    changes: Omit<Partial<PrintTemplateInput>, 'kind'>,
    version: number,
  ): Promise<Result<PrintTemplate>>;
  deletePrintTemplate(id: string): Promise<Result<null>>;
  previewPrintTemplate(id: string): Promise<Result<PrintPreview>>;

  listDisplayDevices(): Promise<Result<readonly DisplayDevice[]>>;
  /** Register a screen; the raw key in the answer is shown once. */
  createDisplayDevice(name: string): Promise<Result<DisplayDeviceWithKey>>;
  updateDisplayDevice(
    id: string,
    changes: DisplayDeviceChanges,
    version: number,
  ): Promise<Result<DisplayDevice>>;
  deleteDisplayDevice(id: string, version: number): Promise<Result<null>>;
  /** The old key stops working; the new raw key in the answer is shown once. */
  rotateDisplayDeviceKey(id: string): Promise<Result<DisplayDeviceWithKey>>;
}
