import { useEffect, useState } from "react";

type ExperimentOption = {
  label: string;
  value: string;
  mode: "fim" | "chat";
};

export const useExperiments = () => {
  const [options, setOptions] = useState<ExperimentOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultValue, setDefaultValue] = useState<string | null>(null);

  useEffect(() => {
    const fetchExperiments = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch("/api/config/experiments", {
          method: "GET",
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch experiments: ${response.status}`);
        }
        
        const data = await response.json();
        
        const experimentOptions = data.experiments.map((experimentId: string) => {
          const mode = experimentId.includes("FIM") ? "fim" : "chat";
          
          const label = experimentId
            .replace("_", " ")
            .split(" ")
            .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
          
          return {
            label,
            value: experimentId,
            mode,
          };
        });
        
        setOptions(experimentOptions);
        
        if (experimentOptions.length > 0) {
          setDefaultValue(experimentOptions[0].value);
        }
      } catch (err) {
        console.error("Error fetching experiments:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch experiments");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchExperiments();
  }, []);
  
  return {
    options,
    isLoading,
    error,
    defaultValue
  };
};