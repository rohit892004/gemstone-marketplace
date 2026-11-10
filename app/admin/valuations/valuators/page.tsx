import Link from "next/link";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatDate } from "@/components/admin/admin-ui";
import { ValuationForm } from "@/components/valuator/valuation-form";
import { listValuators, openRequestsFor } from "@/lib/valuation/admin-valuators";
import { statusLabel } from "@/lib/valuation/display";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";
import { createValuatorAction, resendSetPasswordAction, setActiveAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserRound } from "lucide-react";

export const metadata = { title: "Valuers" };

export default function ValuatorAccountsPage() {
  return (
    <Suspense fallback={null}>
      <ValuatorAccounts />
    </Suspense>
  );
}

async function ValuatorAccounts() {
  await requirePageRole(["ADMIN"]);
  const valuators = await listValuators();
  const openLists = await Promise.all(
    valuators.map((v) => (v.openAssignments > 0 && v.active ? openRequestsFor(v.id) : Promise.resolve([]))),
  );
  const openByValuator = new Map(valuators.map((v, i) => [v.id, openLists[i]]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-medium text-ink">Valuers</h1>
        <p className="text-sm text-ink-soft">
          Valuers are internal staff. Only an admin can create one. There is no public sign-up for this role.
        </p>
      </div>

      <ValuationForm
        title="Add a valuer"
        description="The valuer receives an email with a link to set their own password. The link lasts 30 minutes and works once."
        action={createValuatorAction}
        submitLabel="Create valuer and send link"
        fields={[
          { name: "name", label: "Full name", required: true, maxLength: 120 },
          { name: "email", label: "Email", kind: "text", required: true, maxLength: 254, inputMode: "text", help: "Use the address the valuer reads at work." },
          { name: "mobile", label: "Mobile (optional)", maxLength: 16, inputMode: "numeric", help: "Digits only, with an optional leading +." },
        ]}
      />

      {valuators.length === 0 ? (
        <EmptyState icon={UserRound} title="No valuers yet" body="Add a valuer with the form above." />
      ) : (
        <ul className="space-y-4">
          {valuators.map((valuator) => {
            const open = openByValuator.get(valuator.id) ?? [];
            return (
              <li key={valuator.id} className="space-y-3 border border-line bg-surface-raised p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{valuator.name ?? "No name"}</p>
                    <p className="break-all text-ink-soft">{valuator.email}</p>
                    {valuator.mobile ? <p className="text-ink-soft">{valuator.mobile}</p> : null}
                  </div>
                  <div className="text-right">
                    <Badge tone={valuator.active ? "success" : "neutral"}>
                      {valuator.active ? "Active" : "Deactivated"}
                    </Badge>
                    <p className="mt-1 text-[12px] text-ink-soft">Added {formatDate(valuator.createdAt)}</p>
                  </div>
                </div>

                <p>
                  Open requests: <span className="font-medium">{valuator.openAssignments}</span>{" "}
                  {valuator.openAssignments > 0 ? (
                    <Link href={`${VALUATION_ROUTES.adminQueue}?assignment=${valuator.id}`} className="underline">
                      Show them
                    </Link>
                  ) : null}
                </p>

                {!valuator.active && valuator.openAssignments > 0 ? (
                  <p className="border border-accent bg-accent-soft p-2 text-accent-text">
                    This valuer is deactivated but still holds {valuator.openAssignments} open request
                    {valuator.openAssignments === 1 ? "" : "s"}. Reassign {valuator.openAssignments === 1 ? "it" : "them"} from the request page.
                  </p>
                ) : null}

                {valuator.active && open.length > 0 ? (
                  <div>
                    <p className="font-medium">Open requests that go back to the admin queue if you deactivate this valuer</p>
                    <ul className="mt-1 list-disc pl-5">
                      {open.map((request) => (
                        <li key={request.id}>
                          <Link href={VALUATION_ROUTES.adminDetail(request.id)} className="font-mono underline">
                            {request.reference}
                          </Link>{" "}
                          <span className="text-ink-soft">
                            {request.gemstoneType}, {statusLabel(request.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {valuator.active ? (
                    <>
                      <ValuationForm
                        title="Send a new set-password link"
                        description="Use this if the valuer has not received or used their link. Earlier links stop working."
                        action={resendSetPasswordAction}
                        hidden={{ valuatorId: valuator.id }}
                        submitLabel="Send link"
                      />
                      <ValuationForm
                        title="Deactivate"
                        description="The valuer can no longer sign in or act. Their open requests go back to the admin queue, unassigned."
                        action={setActiveAction}
                        hidden={{ valuatorId: valuator.id, active: "false" }}
                        submitLabel="Deactivate valuer"
                        tone="danger"
                      />
                    </>
                  ) : (
                    <ValuationForm
                      title="Reactivate"
                      description="The valuer can sign in again with their existing password."
                      action={setActiveAction}
                      hidden={{ valuatorId: valuator.id, active: "true" }}
                      submitLabel="Reactivate valuer"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
