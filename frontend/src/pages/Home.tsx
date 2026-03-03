import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, API_URL } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import Guestbook from '../components/Guestbook';
import { useDisplaySettings } from '../context/DisplaySettingsContext';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

export default function Home() {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [pastedApiKey, setPastedApiKey] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [creatingAgentKey, setCreatingAgentKey] = useState(false);
  const [agentKeyNotice, setAgentKeyNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [allowQueryParamAuth, setAllowQueryParamAuth] = useState(true);
  const [confirmDeleteGoalId, setConfirmDeleteGoalId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { settings: displaySettings } = useDisplaySettings();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const data = await api.getGoals();
      setGoals(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    try {
      await api.createGoal({ title: newGoalTitle });
      setNewGoalTitle('');
      loadGoals();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await api.deleteGoal(id);
      loadGoals();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleOpenAgentDialog = async () => {
    setShowAgentDialog(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/settings`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setAllowQueryParamAuth(data.data.allow_query_param_auth);
      }
    } catch {}
  };

  const getAgentLandingUrl = (format?: 'json') => {
    if (!pastedApiKey.trim()) return '';
    if (format === 'json') {
      return `${API_URL}/api/agents/brief?apiKey=${encodeURIComponent(pastedApiKey)}`;
    }
    const baseUrl = window.location.origin;
    return `${baseUrl}/agents?apiKey=${encodeURIComponent(pastedApiKey)}`;
  };

  const handleCopyUrl = () => {
    const url = getAgentLandingUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreview = () => {
    const url = getAgentLandingUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleGenerateAgentKey = async () => {
    if (creatingAgentKey) return;
    try {
      setCreatingAgentKey(true);
      setAgentKeyNotice(null);
      const response = await fetch(`${API_URL}/api/auth/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: `Agent Landing ${new Date().toLocaleString()}`,
          expiresInDays: 365,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || t('home.failedCreateApiKey'));
      }
      const key = data.data?.key;
      setPastedApiKey(key || '');
      setAgentKeyNotice({ type: 'success', message: t('home.newApiKeyGenerated') });
    } catch (err) {
      setAgentKeyNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setCreatingAgentKey(false);
    }
  };

  const perPage = displaySettings.goalsPerPage;
  const totalPages = Math.max(1, Math.ceil(goals.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedGoals = useMemo(
    () => goals.slice((safePage - 1) * perPage, safePage * perPage),
    [goals, safePage, perPage]
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <svg width="64" height="64" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <rect x="0" y="0" width="100" height="100" fill="hsl(0, 100%, 75%)" stroke="white" strokeWidth="2"/>
              <rect x="100" y="0" width="100" height="100" fill="hsl(30, 100%, 75%)" stroke="white" strokeWidth="2"/>
              <rect x="200" y="0" width="100" height="100" fill="hsl(60, 100%, 75%)" stroke="white" strokeWidth="2"/>
              <rect x="0" y="100" width="100" height="100" fill="hsl(120, 100%, 75%)" stroke="white" strokeWidth="2"/>
              <rect x="100" y="100" width="100" height="100" fill="hsl(180, 100%, 75%)" stroke="white" strokeWidth="2"/>
              <rect x="200" y="100" width="100" height="100" fill="hsl(210, 100%, 75%)" stroke="white" strokeWidth="2"/>
              <rect x="0" y="200" width="100" height="100" fill="hsl(240, 100%, 75%)" stroke="white" strokeWidth="2"/>
              <rect x="100" y="200" width="100" height="100" fill="hsl(270, 100%, 75%)" stroke="white" strokeWidth="2"/>
              <rect x="200" y="200" width="100" height="100" fill="hsl(300, 100%, 75%)" stroke="white" strokeWidth="2"/>
            </svg>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">xharada</h1>
              <p className="text-gray-600 mt-2">Your Goal Planning System</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            <button
              onClick={handleOpenAgentDialog}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-900 border border-blue-200 rounded hover:bg-blue-50"
            >
              {t('home.agentLanding')}
            </button>
            <Link
              to="/settings"
              state={{ from: location.pathname }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-100"
            >
              {t('home.settings')}
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-100"
            >
              {t('home.logout')}
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('home.createNewGoal')}</h2>
          <form onSubmit={handleCreateGoal} className="flex gap-4">
            <input
              type="text"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder={t('home.enterGoalTitle')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('home.createGoal')}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">{t('home.yourGoals')}</h2>

          {loading ? (
            <p className="text-gray-500">{t('home.loadingGoals')}</p>
          ) : goals.length === 0 ? (
            <p className="text-gray-500">{t('home.noGoals')}</p>
          ) : (
            <>
              <div className="grid gap-4">
                {paginatedGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900">{goal.title}</h3>
                        {goal.description && (
                          <p className="text-gray-600 mt-1">{goal.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-sm text-gray-500">
                          <span className="capitalize">{t('common.status')}{goal.status}</span>
                          <span>{t('common.created')}{new Date(goal.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          to={`/goal/${goal.id}`}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                        >
                          {t('home.viewGrid')}
                        </Link>
                        <button
                          onClick={() => setConfirmDeleteGoalId(goal.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    {t('home.showingRange', {
                      start: (safePage - 1) * perPage + 1,
                      end: Math.min(safePage * perPage, goals.length),
                      total: goals.length,
                    })}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t('home.prev')}
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 text-sm border rounded ${
                          page === safePage ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t('home.next')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Guestbook */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <Guestbook targetType="user" />
        </div>
      </div>

      {/* Agent Landing Dialog */}
      {showAgentDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{t('home.agentLandingPage')}</h2>
              <button
                onClick={() => setShowAgentDialog(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('home.pasteApiKey')}
                </label>
                <input
                  type="text"
                  value={pastedApiKey}
                  onChange={(e) => setPastedApiKey(e.target.value)}
                  placeholder={t('home.pasteApiKeyPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAgentKey}
                    disabled={creatingAgentKey}
                    className={`px-4 py-2 rounded text-sm text-white ${
                      creatingAgentKey ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {creatingAgentKey ? t('home.generatingKey') : t('home.generateApiKey')}
                  </button>
                  <Link
                    to="/settings"
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    onClick={() => setShowAgentDialog(false)}
                  >
                    {t('home.manageKeysInSettings')}
                  </Link>
                </div>
                {agentKeyNotice && (
                  <p
                    className={`mt-2 text-xs ${
                      agentKeyNotice.type === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {agentKeyNotice.message}
                  </p>
                )}
              </div>

              {pastedApiKey.trim() && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('home.agentLandingUrl')}
                    </label>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={getAgentLandingUrl()}
                          readOnly
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                        />
                        <button
                          onClick={handleCopyUrl}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
                        >
                          {copied ? t('common.copied') : t('common.copy')}
                        </button>
                      </div>
                      {allowQueryParamAuth && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={getAgentLandingUrl('json')}
                            readOnly
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                          />
                          <button
                            onClick={() => {
                              const url = getAgentLandingUrl('json');
                              navigator.clipboard.writeText(url);
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
                          >
                            {t('home.copyJsonUrl')}
                          </button>
                        </div>
                      )}
                    </div>
                    {allowQueryParamAuth ? (
                      <>
                        <p className="text-xs text-gray-500 mt-2">
                          {t('home.shareUrlInfo')}
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                          {t('home.shareUrlWarning')}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">
                        {t('home.jsonUrlDisabled')}<Link to="/settings" className="text-blue-600 underline" onClick={() => setShowAgentDialog(false)}>{t('home.jsonUrlDisabledSettings')}</Link>{t('home.jsonUrlDisabledSuffix')}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handlePreview}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {t('home.previewLandingPage')}
                    </button>
                    <Link
                      to="/settings"
                      onClick={() => setShowAgentDialog(false)}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-center"
                    >
                      {t('home.manageApiKeys')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteGoalId && (
        <ConfirmModal
          title={t('home.deleteGoalTitle')}
          message={t('home.deleteGoalMessage')}
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            handleDeleteGoal(confirmDeleteGoalId);
            setConfirmDeleteGoalId(null);
          }}
          onCancel={() => setConfirmDeleteGoalId(null)}
        />
      )}
    </div>
  );
}
