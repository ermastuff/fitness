let cachedApp: any = null;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export default async (req: any, res: any) => {
  try {
    if (!cachedApp) {
      const mod = await import('../src/app.js');
      cachedApp = mod.default;
    }
    return cachedApp(req, res);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('API bootstrap error:', error);
    return res.status(500).json({
      error: 'API_BOOTSTRAP_FAILED',
      message,
    });
  }
};
