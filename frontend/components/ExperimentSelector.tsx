import { type FC, useEffect } from 'react';
import { useExperiments } from '../hooks/useExperiments';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

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
    return (
      <div className="text-red-500 text-sm">
        Failed to load experiments: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-row align-middle content-center">
      <label
        htmlFor="experiment-select"
        className="block text-md font-medium mr-4 content-center"
      >
        Choose your experiments
      </label>
      <Select
        disabled={disabled || isLoading || options.length === 0}
        onValueChange={onChange}
        value={value ?? ''}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue
            placeholder={
              isLoading ? 'Loading experiments...' : 'Select an experiment'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {options.length === 0 && !isLoading && (
        <div className="text-amber-600 text-sm mt-1">
          No experiments available
        </div>
      )}
    </div>
  );
};
