export function silenceConsoleErrors() {
  const originalError = console.error;

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  return {
    expectConsoleError: (matcher?: string | RegExp) => {
      expect(console.error).toHaveBeenCalled();
      if (matcher) {
        const calls = (console.error as jest.Mock).mock.calls;
        const found = calls.some((args) => {
          const message = args.join(' ');
          return typeof matcher === 'string'
            ? message.includes(matcher)
            : matcher.test(message);
        });
        expect(found).toBeTruthy();
      }
    },
    getConsoleErrors: () => (console.error as jest.Mock).mock.calls,
    clearConsoleErrors: () => (console.error as jest.Mock).mockClear(),
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
