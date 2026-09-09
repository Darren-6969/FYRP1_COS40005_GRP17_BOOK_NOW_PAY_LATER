import prisma from "../src/config/db.js";
import { generateApiKey } from "../src/utils/apiKey.js";

// Generates a key for every operator that doesn't have one yet.
// Keys are printed ONCE here — copy them somewhere safe immediately.
async function main() {
  const operators = await prisma.operator.findMany({
    where: { apiKeyHash: null },
    select: { id: true, operatorCode: true, companyName: true },
  });

  if (operators.length === 0) {
    console.log("All operators already have API keys.");
    return;
  }

  console.log(`Generating keys for ${operators.length} operator(s).`);
  console.log("Store these now — they are shown only once:\n");

  for (const op of operators) {
    const apiKey = generateApiKey();

    await prisma.operator.update({
      where: { id: op.id },
      data: {
        apiKeyHash: apiKey.hash,
        apiKeyPrefix: apiKey.prefix,
        apiKeyRotatedAt: new Date(),
      },
    });

    console.log(`${op.operatorCode}  ${op.companyName}`);
    console.log(`  API key: ${apiKey.key}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());