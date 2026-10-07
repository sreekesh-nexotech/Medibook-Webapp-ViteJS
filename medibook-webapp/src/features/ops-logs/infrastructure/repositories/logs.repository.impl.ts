import { attempt } from '@/core/error/attempt';

import type { LogsRepository } from '@/features/ops-logs/domain/repositories/logs.repository';
import {
  getLogs,
  getLogsCsv,
} from '@/features/ops-logs/infrastructure/data-sources/remote/logs.api';
import { toLogsPage } from '@/features/ops-logs/infrastructure/data-sources/remote/logs.response';

export const logsRepository: LogsRepository = {
  getLogs: (query) => attempt(async () => toLogsPage(await getLogs(query))),
  exportLogsCsv: (filters) => attempt(() => getLogsCsv(filters)),
};
