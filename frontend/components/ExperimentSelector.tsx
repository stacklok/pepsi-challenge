import { FC, useEffect } from "react";
import { useExperiments } from "../hooks/useExperiments";
import { Select } from "./Select";

interface ExperimentSelectorProps {
  value: string | undefined;
  onChange: (experimentId: string) => void;
  disabled?: boolean;
  autoSelect?: boolean;
}

export const ExperimentSelector: FC<ExperimentSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  autoSelect = true,
}) => {
  const { options, isLoading, error } = useExperiments();
  
  useEffect(() => {
    if (autoSelect && !value && options.length > 0 && !disabled) {
      onChange(options[0].value);
    }
  }, [autoSelect, value, options, disabled, onChange]);
  
  if (error) {
    return <div className="text-red-500 text-sm">Failed to load experiments: {error}</div>;
  }
  
  return (
    <div className="mb-4">
      <label
        htmlFor="experiment-select"
        className="block text-lg font-medium text-gray-200 mb-2"
      >
        Choose your experiments
      </label>
      <Select
        id="experiment-select"
        className="w-[200px] bg-gray-900"
        disabled={disabled || isLoading || options.length === 0}
        value={value ?? ''}
        onChange={onChange}
        options={options}
        placeholder={isLoading ? "Loading experiments..." : "Select an experiment"}
      />
      {options.length === 0 && !isLoading && (
        <div className="text-amber-600 text-sm mt-1">
          No experiments available
        </div>
      )}
    </div>
  );
};