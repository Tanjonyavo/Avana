import { requireAdminPageSession } from "@/lib/server/admin-page";
import { FinanceCalculator } from "@/components/finance-calculator";
export default async function FinancePage() {
  await requireAdminPageSession();
  return <FinanceCalculator />;
}
