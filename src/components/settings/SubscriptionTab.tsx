export function SubscriptionTab() {
  return (
    <div>
      <h2 className="font-bold text-lg mb-6 mt-10 first:mt-0">Subscription</h2>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-gray-100 last:border-0">
        <div>
          <p className="font-medium text-black text-sm sm:text-base">Manage billing</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Billing is handled securely through our payments partner.
          </p>
        </div>
        <button
          type="button"
          className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-black transition-colors"
        >
          Manage subscription
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-gray-100 last:border-0">
        <div>
          <p className="font-medium text-black text-sm sm:text-base">Cancel subscription</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            You&apos;ll keep access until the end of the current billing period.
          </p>
        </div>
        <button
          type="button"
          className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors"
        >
          Cancel subscription
        </button>
      </div>
    </div>
  );
}
