'use client';

/**
 * API Key Manager Component
 * Create, view, and revoke API keys
 */

import { useState, useEffect } from 'react';
import { createAuthClient } from '@/lib/auth';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export function ApiKeyManager({ userId, workspaceId }: { userId: string; workspaceId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, [userId]);

  async function fetchKeys() {
    try {
      const supabase = createAuthClient();
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setError('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) {
      setError('Please enter a name for the API key');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          workspace_id: workspaceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const { api_key } = await response.json();
      setNewKey(api_key);
      setNewKeyName('');
      setShowCreateForm(false);
      await fetchKeys();
    } catch (err) {
      console.error('Error creating API key:', err);
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      await fetchKeys();
    } catch (err) {
      console.error('Error revoking API key:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="bg-[#16213e]/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
        <p className="text-gray-400">Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New Key Display (one-time show) */}
      {newKey && (
        <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-2">API Key Created!</h3>
          <p className="text-gray-300 text-sm mb-4">
            Copy this key now. You won't be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-3 bg-[#1a1a2e] border border-gray-700 rounded-lg text-green-400 font-mono text-sm">
              {newKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                alert('API key copied to clipboard!');
              }}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-4 text-gray-400 hover:text-white text-sm transition-colors"
          >
            I've saved my key
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-[#16213e]/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4">Create New API Key</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="keyName" className="block text-sm font-medium text-gray-200 mb-2">
                Key Name
              </label>
              <input
                id="keyName"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="My Production Key"
                className="w-full px-4 py-3 bg-[#1a1a2e] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                disabled={creating}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createKey}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg transition-colors"
              >
                {creating ? 'Creating...' : 'Create Key'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName('');
                  setError(null);
                }}
                disabled={creating}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="bg-[#16213e]/50 backdrop-blur-sm border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">Your API Keys</h3>
            <p className="text-gray-400 text-sm mt-1">Use these keys to access SpecVault API</p>
          </div>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Create New Key
            </button>
          )}
        </div>

        {keys.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No API keys yet. Create one to get started with the API.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Name</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Key Prefix</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Created</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Last Used</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20">
                    <td className="p-4 text-white">{key.name}</td>
                    <td className="p-4 text-gray-400 font-mono text-sm">{key.key_prefix}...</td>
                    <td className="p-4 text-gray-400">{formatDate(key.created_at)}</td>
                    <td className="p-4 text-gray-400">{formatDate(key.last_used_at)}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          key.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {key.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="p-4">
                      {key.is_active && (
                        <button
                          onClick={() => revokeKey(key.id)}
                          className="text-red-400 hover:text-red-300 text-sm transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
