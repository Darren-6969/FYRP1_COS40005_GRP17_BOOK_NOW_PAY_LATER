import prisma from "../config/db.js";

export function getRolePrefix(role) {
  const prefixMap = {
    CUSTOMER: "CUS",
    NORMAL_SELLER: "OPR",
    MASTER_SELLER: "ADN",
  };
  return prefixMap[role] || "USR";
}

// Generates the next sequential user code for a role, e.g. CUS0007.
export async function generateUserCode(role) {
  const prefix = getRolePrefix(role);

  const latestUser = await prisma.user.findFirst({
    where: { role, userCode: { startsWith: prefix } },
    orderBy: { userCode: "desc" },
    select: { userCode: true },
  });

  let nextNumber = 1;
  if (latestUser?.userCode) {
    const parsed = Number(latestUser.userCode.replace(prefix, ""));
    if (Number.isInteger(parsed) && parsed > 0) nextNumber = parsed + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}