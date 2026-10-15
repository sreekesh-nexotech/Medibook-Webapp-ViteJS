import { attempt } from '@/core/error/attempt';

import type { ConfigRepository } from '@/features/settings/domain/repositories/config.repository';
import {
  deleteCounter,
  listSettingsCounters,
  patchCounter,
  postCounter,
} from '@/features/settings/infrastructure/data-sources/remote/counters.api';
import { toCounter } from '@/features/settings/infrastructure/data-sources/remote/counters.response';
import {
  deleteDisplayDevice,
  listDisplayDevices,
  patchDisplayDevice,
  postDisplayDevice,
  postRotateDisplayDeviceKey,
} from '@/features/settings/infrastructure/data-sources/remote/displayDevices.api';
import {
  toDisplayDevice,
  toDisplayDeviceWithKey,
} from '@/features/settings/infrastructure/data-sources/remote/displayDevices.response';
import {
  getNumberingPreview,
  getNumberingSeries,
  putNumberingSeries,
} from '@/features/settings/infrastructure/data-sources/remote/numbering.api';
import { toNumberingSeries } from '@/features/settings/infrastructure/data-sources/remote/numbering.response';
import {
  deletePrintTemplate,
  listPrintTemplates,
  patchPrintTemplate,
  postPrintTemplate,
  postPrintTemplatePreview,
} from '@/features/settings/infrastructure/data-sources/remote/printTemplates.api';
import {
  toPrintPreview,
  toPrintTemplate,
} from '@/features/settings/infrastructure/data-sources/remote/printTemplates.response';

export const configRepository: ConfigRepository = {
  listNumbering: () =>
    attempt(async () => (await getNumberingSeries()).results.map(toNumberingSeries)),
  updateNumbering: (kind, changes, version) =>
    attempt(async () => toNumberingSeries(await putNumberingSeries(kind, changes, version))),
  previewNumbering: (kind) => attempt(async () => (await getNumberingPreview(kind)).next_number),

  listCounters: () => attempt(async () => (await listSettingsCounters()).map(toCounter)),
  createCounter: (input) => attempt(async () => toCounter(await postCounter(input))),
  updateCounter: (id, changes, version) =>
    attempt(async () => toCounter(await patchCounter(id, changes, version))),
  deleteCounter: (id, version) =>
    attempt(async () => {
      await deleteCounter(id, version);
      return null;
    }),

  listPrintTemplates: () => attempt(async () => (await listPrintTemplates()).map(toPrintTemplate)),
  createPrintTemplate: (input) =>
    attempt(async () => toPrintTemplate(await postPrintTemplate(input))),
  updatePrintTemplate: (id, changes, version) =>
    attempt(async () => toPrintTemplate(await patchPrintTemplate(id, changes, version))),
  deletePrintTemplate: (id) =>
    attempt(async () => {
      await deletePrintTemplate(id);
      return null;
    }),
  previewPrintTemplate: (id) =>
    attempt(async () => toPrintPreview(await postPrintTemplatePreview(id))),

  listDisplayDevices: () => attempt(async () => (await listDisplayDevices()).map(toDisplayDevice)),
  createDisplayDevice: (name) =>
    attempt(async () => toDisplayDeviceWithKey(await postDisplayDevice(name))),
  updateDisplayDevice: (id, changes, version) =>
    attempt(async () => toDisplayDevice(await patchDisplayDevice(id, changes, version))),
  deleteDisplayDevice: (id, version) =>
    attempt(async () => {
      await deleteDisplayDevice(id, version);
      return null;
    }),
  rotateDisplayDeviceKey: (id) =>
    attempt(async () => toDisplayDeviceWithKey(await postRotateDisplayDeviceKey(id))),
};
