import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Create RFQ Request - ElectroMarket',
  description: 'Create a new request for quotation',
};

export default function CreateRequestPage() {
  return (
    <main className="hub-scope min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8">
          <ArrowLeft size={20} />
          Back to Home
        </Link>

        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold mb-4">Create RFQ Request</h1>
          <p className="text-gray-600 mb-6">
            This page will be developed to allow users to create new RFQ requests, upload BOMs, and get quotes from suppliers.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="font-bold text-blue-900 mb-2">Coming Soon</h2>
            <p className="text-blue-800">
              RFQ creation form will include:
            </p>
            <ul className="text-blue-800 mt-3 space-y-2 ml-4">
              <li>✓ BOM file upload</li>
              <li>✓ Component details form</li>
              <li>✓ Supplier selection</li>
              <li>✓ Quote request submission</li>
              <li>✓ Integration with database</li>
            </ul>
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
