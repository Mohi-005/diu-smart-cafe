export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

        <h1 className="text-2xl font-bold text-gray-900">
          DIU Smart Cafe
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Loading...
        </p>
      </div>
    </main>
  );
}