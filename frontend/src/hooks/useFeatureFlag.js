import { useEffect, useState } from "react";
import { getFeatureFlags } from "../services/feature_flag_service";

export function useFeatureFlag(key, operatorId = null) {
  const requestKey = `${key}:${operatorId ?? ""}`;
  const [result, setResult] = useState({
    requestKey: null,
    enabled: false,
  });

  useEffect(() => {
    let active = true;
    getFeatureFlags(operatorId)
      .then((flags) => {
        if (active) setResult({ requestKey, enabled: flags[key] === true });
      })
      .catch(() => {
        if (active) setResult({ requestKey, enabled: false });
      });
    return () => {
      active = false;
    };
  }, [key, operatorId, requestKey]);

  return {
    enabled: result.requestKey === requestKey && result.enabled,
    loading: result.requestKey !== requestKey,
  };
}
