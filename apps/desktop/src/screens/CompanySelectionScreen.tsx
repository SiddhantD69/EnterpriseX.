type Company = {
  organization: {
    id: string;
    code: string;
    name: string;
  };
  company: {
    id: string;
    code: string;
    name: string;
  };
};

type CompanySelectionScreenProps = {
  companies: Company[];
  onSelectCompany: (companyId: string) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
};

export function CompanySelectionScreen({
  companies,
  onSelectCompany,
  isLoading,
  errorMessage,
}: CompanySelectionScreenProps) {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
      <section className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-8">
            <p className="text-sm font-semibold text-blue-600 tracking-wide uppercase">
              EnterpriseX
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Select company
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Your account has access to multiple companies. Select the company
              you want to work with.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-3">
            {companies.map((item) => (
              <button
                key={item.company.id}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectCompany(item.company.id)}
                className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {item.company.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Company code: {item.company.code}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Organization: {item.organization.name} (
                      {item.organization.code})
                    </p>
                  </div>

                  <span className="text-sm font-medium text-blue-600">
                    Select →
                  </span>
                </div>
              </button>
            ))}
          </div>

          {isLoading && (
            <p className="mt-5 text-center text-sm text-slate-500">
              Loading company context...
            </p>
          )}

          {!isLoading && companies.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No active companies are available for this account.
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          EnterpriseX ERP
        </p>
      </section>
    </main>
  );
}