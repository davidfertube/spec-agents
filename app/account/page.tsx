/**
 * Account Settings Page
 * Profile management, API keys, subscription
 */

import { redirect } from 'next/link';
import { serverAuth } from '@/lib/auth';
import { ProfileForm } from '@/components/account/profile-form';
import { ApiKeyManager } from '@/components/account/api-key-manager';
import { UserMenu } from '@/components/layout/user-menu';
import Link from 'next/link';

export const metadata = {
  title: 'Account Settings | SpecVault',
  description: 'Manage your account and API keys',
};

export default async function AccountPage() {
  const user = await serverAuth.getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const profile = await serverAuth.getUserProfile(user.id);

  if (!profile) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f1e] via-[#1a1a2e] to-[#0f0f1e]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#16213e]/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-bold text-white">
            SpecVault
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/account" className="text-white hover:text-blue-400 transition-colors">
              Account
            </Link>
            {profile.role === 'admin' || profile.role === 'enterprise' ? (
              <Link href="/workspace" className="text-gray-400 hover:text-white transition-colors">
                Workspace
              </Link>
            ) : null}
            <UserMenu user={user} profile={profile} />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Account Settings</h1>

        <div className="space-y-8">
          {/* Profile Section */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Profile</h2>
            <ProfileForm profile={profile} />
          </section>

          {/* API Keys Section */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">API Keys</h2>
            <ApiKeyManager userId={user.id} workspaceId={profile.workspace_id!} />
          </section>

          {/* Danger Zone */}
          <section>
            <h2 className="text-2xl font-bold text-red-500 mb-4">Danger Zone</h2>
            <div className="p-6 bg-red-500/10 border border-red-500/50 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Delete Account</h3>
              <p className="text-gray-400 text-sm mb-4">
                Once you delete your account, there is no going back. All your documents and data will be permanently removed.
              </p>
              <button className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">
                Delete Account
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
