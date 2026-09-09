export default function AdminStakeholdersPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-surface-200 bg-white p-8">
      <span className="rounded-full bg-surface-100 px-3 py-1 text-sm text-surface-600">Deactivated for now</span>
      <h1 className="text-3xl font-semibold text-surface-900">Team</h1>
      <p className="text-surface-600">Team will help coordinate the people supporting LocalVIP onboarding, including local organizers, volunteers and launch partners.</p>
      <p className="text-surface-600">The planned workspace will bring together assigned cities, campaigns, businesses and causes, with clear responsibilities and follow-up tasks.</p>
      <p className="text-surface-600">This workspace is not active yet. Use User Management to manage individual users and their access.</p>
      <a href="/admin/users" className="inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white">Open User Management</a>
    </section>
  )
}
