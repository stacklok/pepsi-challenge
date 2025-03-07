interface Props {
  prefix: string;
  suffix: string;
  isSuffixVisible: boolean;
  setPrefix: (val: string) => void;
  setSuffix: (val: string) => void;
  setIsSuffixVisible: (isOpen: boolean) => void;
}

export function Fim({
  prefix,
  suffix,
  isSuffixVisible,
  setPrefix,
  setSuffix,
  setIsSuffixVisible,
}: Props) {
  return (
    <>
      <div>
        <label
          htmlFor="code-input"
          className="block text-lg font-medium text-gray-200 mb-2"
        >
          Enter your code snippet
        </label>
        <textarea
          id="code-input"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="w-full h-48 p-4 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
          placeholder="def main():"
        />
      </div>
      <div>
        <button
          type="button"
          onClick={() => setIsSuffixVisible(!isSuffixVisible)}
          className="text-blue-500 hover:underline"
        >
          Enter Suffix (Optional)
        </button>
      </div>
      {isSuffixVisible && (
        <>
          <div>
            <label
              htmlFor="code-suffix"
              className="block text-lg font-medium text-gray-200 mb-2"
            >
              Enter your code suffix
            </label>
            <textarea
              id="code-suffix"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              className="w-full h-48 p-4 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
              placeholder="print('Hello, World!')"
            />
          </div>
        </>
      )}
    </>
  );
}
