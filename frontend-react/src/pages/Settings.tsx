import { PageTransition } from '@/components/motion';

export function SettingsPage() {
  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Coming soon — migrating from vanilla</p>
      </div>
    </PageTransition>
  );
}
