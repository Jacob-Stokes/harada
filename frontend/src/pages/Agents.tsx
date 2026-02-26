import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api/client';

interface AgentBriefResponse {
  goals: {
    id: string;
    title: string;
    status: string;
    description?: string | null;
    created_at: string;
    subGoals: {
      id: string;
      title: string;
      position: number;
      actions: { id: string; title: string; position: number; lastUpdated?: string }[];
    }[];
  }[];
  guidance: {
    workflow: string[];
    etiquette: string[];
  };
  api: {
    baseUrl: string;
    summaryEndpoint: string;
  };
  generatedAt: string;
}

export default function Agents() {
  const [searchParams] = useSearchParams();
  const [brief, setBrief] = useState<AgentBriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');

  useEffect(() => {
    // Check for API key in URL params first, otherwise leave empty for manual entry
    const urlApiKey = searchParams.get('apiKey');
    if (urlApiKey) {
      setApiKey(urlApiKey);
    }
  }, [searchParams]);

  useEffect(() => {
    const requestedJson = searchParams.get('format') === 'json';
    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers: Record<string, string> = {};
        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }
        const response = await fetch(`${API_URL}/api/agents/brief`, {
          credentials: apiKey ? 'omit' : 'include',
          headers,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        setBrief(result.data);

        if (requestedJson) {
          const pretty = JSON.stringify(result.data, null, 2);
          const blob = new Blob([pretty], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          window.location.href = url;
          return;
        }
      } catch (err) {
        setError((err as Error).message);
        setBrief(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [apiKey, searchParams]);

  const renderGoalOverview = () => {
    if (!brief || brief.goals.length === 0) {
      return <p className="text-gray-500">No goals defined yet.</p>;
    }
    return brief.goals.map((goal) => (
      <div key={goal.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{goal.title}</h3>
            <p className="text-sm text-gray-500 capitalize">Status: {goal.status}</p>
          </div>
          <Link
            to={`/goal/${goal.id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            Open in app →
          </Link>
        </div>
        <div className="mt-3 grid gap-2">
          {goal.subGoals.map((sg) => (
            <div
              key={sg.id}
              className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm flex flex-col gap-1"
            >
              <div className="flex justify-between">
                <span className="font-medium text-gray-800">
                  #{sg.position} {sg.title}
                </span>
                <span className="text-gray-500 text-xs">
                  {sg.actions.length}/8 actions
                </span>
              </div>
              {sg.actions.length > 0 && (
                <div className="text-xs text-gray-600 line-clamp-2">
                  {sg.actions.map((action) => action.title).join(' • ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-blue-600">Harada Method · Agent Briefing</p>
            <h1 className="text-4xl font-bold text-gray-900">Agent Landing Page</h1>
            <p className="text-gray-600 mt-2 max-w-3xl">
              Welcome! This is Jacob’s single source of truth for life goals. Review the overview below,
              then use the API section to authenticate and interact with the grid programmatically.
            </p>
          </div>
          <Link
            to="/settings"
            className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
          >
            Manage API Keys
          </Link>
        </div>

        {!apiKey && (
          <div className="mt-6 bg-blue-50 border border-blue-200 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Provide an API Key</h3>
            <p className="text-sm text-blue-700 mb-4">
              Enter your API key below or add it to the URL as <code className="bg-blue-100 px-1 rounded">?apiKey=YOUR_KEY</code>
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key here..."
                className="flex-1 px-4 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Link
                to="/settings"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
              >
                Get API Key
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6 text-gray-500">
            Loading agent brief…
          </div>
        ) : apiKey && brief ? (
          <>
            {/* Guidance and API Info - BEFORE Goals */}
            <section className="mt-10 grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">API Information</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>
                    Base URL: <code className="bg-gray-100 px-1 rounded">{brief.api.baseUrl}</code>
                  </p>
                  <p>Include the API key in the <code>x-api-key</code> header.</p>
                  <p>
                    Recommended endpoint: <code className="bg-gray-100 px-1 rounded">{brief.api.summaryEndpoint}</code>
                  </p>
                </div>
                <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded overflow-x-auto">
{`curl -H "x-api-key: $API_KEY" \\
  ${brief.api.baseUrl}${brief.api.summaryEndpoint}`}
                </pre>
              </div>
              <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Agent Brief</h3>
                <p className="text-sm text-gray-600">
                  Harada grid = 1 primary goal → 8 sub-goals → 8 actions each. Keep the structure intact.
                </p>
                <p className="text-xs text-gray-500">
                  Generated: {new Date(brief.generatedAt).toLocaleString()}
                </p>
              </div>
            </section>

            <section className="mt-10 grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-xl font-semibold mb-3">Workflow Suggestions</h3>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
                  {brief.guidance.workflow.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ol>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
                <h3 className="text-xl font-semibold">Etiquette</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
                  {brief.guidance.etiquette.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Goals - AFTER Guidance and API */}
            <section className="mt-10 space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Current Goals</h2>
              <div className="space-y-4">{renderGoalOverview()}</div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
