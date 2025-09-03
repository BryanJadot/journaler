import { convertToModelMessages, streamText, UIMessage } from 'ai';

// (Optional) prefer Edge for low-latency streaming
export const runtime = 'edge';
// Allow up to 30s for generation (tweak as needed)
export const maxDuration = 120;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: 'openai/gpt-5',
    messages: convertToModelMessages(messages),
    temperature: 0.1,
    system:
      'Format your responses using markdown. Use **bold**, \
      *italic*, `code`, ```code blocks```, lists, and other markdown elements to \
      make your responses clear and well-formatted. \
      Unless it does not make sense at all, your responses need to be structured \
      with good headers and subheaders.',
  });

  // Streams as Server-Sent Events in the AI SDK’s format
  return result.toUIMessageStreamResponse();
}
