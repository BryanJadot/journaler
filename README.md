# Journaler

A Next.js application with authentication and chat functionality.

## Development Commands

### Setup

```bash
npm install                    # Install dependencies
```

### Development

```bash
npm run dev                    # Start development server (http://localhost:3000)
npm run build                  # Build for production
npm start                      # Start production server
```

### Code Quality

```bash
npm run lint                   # Run ESLint (with auto import sorting)
npm run organize-imports       # Organize imports manually
npm test                       # Run Jest tests
npm run test:watch            # Run tests in watch mode
```

### Pre-commit Hooks

The project uses Husky to run checks before commits:

- TypeScript type checking (`tsc --noEmit`)
- ESLint with `--max-warnings 0` (blocks commits on warnings)
- Jest tests
- Auto-format with Prettier

## Project Structure

- **Authentication**: JWT-based auth with HTTP-only cookies
- **Database**: Drizzle ORM with Neon PostgreSQL
- **Testing**: Jest with comprehensive test coverage
- **Linting**: ESLint with automatic import sorting
- **UI**: Tailwind CSS with Next.js App Router

## Key Features

- 🔐 **Secure Authentication**: Login/signup with bcrypt password hashing
- 💬 **Chat Interface**: AI-powered chat with OpenAI integration
- 🛡️ **Auth Protection**: Route-level authentication middleware
- 🧪 **Full Test Coverage**: Unit and integration tests
- 📝 **Code Quality**: Auto-formatting, import sorting, type checking
- 🚀 **Edge Runtime**: Optimized for performance
