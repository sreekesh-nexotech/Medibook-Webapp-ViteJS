/** Query keys for platform message templates. */
export const messageTemplatesKeys = {
  all: ['ops-message-templates'] as const,
  list: () => [...messageTemplatesKeys.all, 'list'] as const,
};
