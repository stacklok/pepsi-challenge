import { Textarea } from '../ui/textarea';

interface Props {
  prompt: string;
  setPrompt: (prompt: string) => void;
}

export function Chat({ prompt, setPrompt }: Props) {
  return (
    <div>
      <label
        htmlFor="chat-code-gen"
        className="block text-medium font-medium mb-2"
      >
        Enter your prompt for code generation
      </label>

      <Textarea
        id="chat-code-gen"
        className="h-24"
        value={prompt}
        onChange={(val) => setPrompt(val.target.value)}
        placeholder="e.g., Add function to calculate factorial"
      />
    </div>
  );
}
