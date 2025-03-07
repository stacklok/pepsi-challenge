interface Props {
  prompt: string;
  setPrompt: (prompt: string) => void;
}

export function Chat({ prompt, setPrompt }: Props) {
  return (
    <div className="my-2">
      <label
        htmlFor="chat-code-gen"
        className="block text-lg font-medium text-gray-200 mb-2"
      >
        Enter your prompt for code generation
      </label>

      <input
        id="chat-code-gen"
        value={prompt}
        onChange={(val) => setPrompt(val.target.value)}
        placeholder="e.g., Add function to calculate factorial"
        className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm text-gray-100
                          focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
      />
    </div>
  );
}
