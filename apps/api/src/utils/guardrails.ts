export const isDestructiveAllowed = () => process.env.ALLOW_DB_DESTRUCTIVE === 'true';

export const assertNonDestructive = (context?: string) => {
  if (!isDestructiveAllowed()) {
    const suffix = context ? ` (${context})` : '';
    throw new Error(
      `Destructive operation blocked${suffix}. Set ALLOW_DB_DESTRUCTIVE="true" to allow.`,
    );
  }
};
