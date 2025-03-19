import { Input } from '../ui/input';

interface Props {
  prompt: string;
  setPrompt: (prompt: string) => void;
}

export function Chat({ prompt, setPrompt }: Props) {
  return (
    <div className="my-2">
      <label htmlFor="chat-code-gen" className="block text-lg font-medium mb-2">
        Enter your prompt for code generation
      </label>

      <Input
        id="chat-code-gen"
        value={prompt}
        onChange={(val) => setPrompt(val.target.value)}
        placeholder="e.g., Add function to calculate factorial"
      />
    </div>
  );
}
