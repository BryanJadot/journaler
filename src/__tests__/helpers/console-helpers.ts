function createConsoleSilencer(method: 'error' | 'warn') {
  const original = console[method];

  beforeAll(() => {
    console[method] = jest.fn();
  });

  afterAll(() => {
    console[method] = original;
  });

  const capitalizedMethod = method.charAt(0).toUpperCase() + method.slice(1);

  return {
    [`expectConsole${capitalizedMethod}`]: (matcher?: string | RegExp) => {
      expect(console[method]).toHaveBeenCalled();
      if (matcher) {
        const calls = (console[method] as jest.Mock).mock.calls;
        const found = calls.some((args) => {
          const message = args.join(' ');
          return typeof matcher === 'string'
            ? message.includes(matcher)
            : matcher.test(message);
        });
        expect(found).toBeTruthy();
      }
    },
    [`getConsole${capitalizedMethod}s`]: () =>
      (console[method] as jest.Mock).mock.calls,
    [`clearConsole${capitalizedMethod}s`]: () =>
      (console[method] as jest.Mock).mockClear(),
  };
}

export function silenceConsoleErrors() {
  return createConsoleSilencer('error');
}

export function silenceConsoleWarnings() {
  return createConsoleSilencer('warn');
}

export function silenceConsole() {
  const errorHelpers = silenceConsoleErrors();
  const warningHelpers = silenceConsoleWarnings();

  return {
    ...errorHelpers,
    ...warningHelpers,
  };
}

export function silenceConsoleErrorsForBlock(fn: () => void | Promise<void>) {
  return async () => {
    const originalError = console.error;
    console.error = jest.fn();
    try {
      await fn();
    } finally {
      console.error = originalError;
    }
  };
}
