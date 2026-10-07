import test from "node:test";
import assert from "node:assert/strict";
import {
  clearFeatureFlagCache,
  getFeatureFlags,
} from "../../src/services/feature_flag_service.js";

test("feature flags use cached database rows and operator overrides", async () => {
  clearFeatureFlagCache();
  let reads = 0;
  const database = {
    featureFlag: {
      async findMany() {
        reads += 1;
        return [
          { key: "demoFeature", environment: "test", enabled: false, operatorId: null },
          { key: "demoFeature", environment: "test", enabled: true, operatorId: 42 },
        ];
      },
    },
  };

  const globalFlags = await getFeatureFlags(null, database);
  const operatorFlags = await getFeatureFlags(42, database);

  assert.equal(globalFlags.demoFeature, false);
  assert.equal(operatorFlags.demoFeature, true);
  assert.equal(reads, 1);
});
