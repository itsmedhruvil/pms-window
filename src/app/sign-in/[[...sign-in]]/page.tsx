import { SignIn } from '@clerk/nextjs';
import { Factory } from 'lucide-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen md:h-screen bg-white flex flex-col md:flex-row overflow-auto md:overflow-hidden">
      {/* Left panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-between p-8 xl:p-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-white flex items-center justify-center">
            <Factory className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-black text-sm tracking-tight">WINDOW ERP</p>
            <p className="text-gray-500 text-[10px] font-mono tracking-widest uppercase">
              Manufacturing Operations
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-3xl xl:text-4xl font-black text-white leading-tight">
            Factory-grade<br />
            operations<br />
            management.
          </h1>
          <p className="text-gray-400 text-sm font-mono leading-relaxed max-w-xs">
            Real-time workflow control across Office Admin, Purchase,
            Store, and Marketing — with strict dependency enforcement
            and alert-driven priority escalation.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Departments', value: '4' },
            { label: 'Workflow Stages', value: '14+' },
            { label: 'Alert Types', value: '4' },
            { label: 'Realtime Sync', value: '✓' },
          ].map(({ label, value }) => (
            <div key={label} className="border border-gray-800 p-3">
              <p className="text-white font-black text-xl font-mono">{value}</p>
              <p className="text-gray-500 text-[10px] font-mono uppercase tracking-wide mt-0.5">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: Clerk sign-in */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black flex items-center justify-center">
                <Factory className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-sm tracking-tight">WINDOW ERP</span>
            </div>
            <h2 className="text-lg font-black text-gray-900 mt-4">Sign in to your account</h2>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Manufacturing operations management
            </p>
          </div>
          <SignIn
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                card: 'shadow-none border border-gray-200 rounded-none',
                headerTitle: 'font-black text-gray-900',
                headerSubtitle: 'font-mono text-xs',
                formButtonPrimary: 'bg-black hover:bg-gray-800 rounded-none font-mono text-xs uppercase tracking-wide',
                formFieldInput: 'rounded-none border-gray-200 focus:border-black font-mono text-xs',
                footerActionLink: 'text-black font-bold',
                rootBox: 'w-full',
                main: 'w-full',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}