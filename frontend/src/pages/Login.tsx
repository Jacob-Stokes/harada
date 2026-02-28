import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Login failed');
        return;
      }

      // Successful login - redirect to home
      navigate('/');
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex flex-col items-center mb-6">
          <svg width="80" height="80" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" className="mb-4">
            <rect x="0" y="0" width="100" height="100" fill="hsl(0, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <rect x="100" y="0" width="100" height="100" fill="hsl(30, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <rect x="200" y="0" width="100" height="100" fill="hsl(60, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <rect x="0" y="100" width="100" height="100" fill="hsl(120, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <rect x="100" y="100" width="100" height="100" fill="hsl(180, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <rect x="200" y="100" width="100" height="100" fill="hsl(210, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <rect x="0" y="200" width="100" height="100" fill="hsl(240, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <rect x="100" y="200" width="100" height="100" fill="hsl(270, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <rect x="200" y="200" width="100" height="100" fill="hsl(300, 100%, 75%)" stroke="white" strokeWidth="2"/>
            <path d="M 120 120 L 180 180 M 180 120 L 120 180" stroke="rgba(0, 0, 0, 0.8)" strokeWidth="20" strokeLinecap="round" fill="none"/>
          </svg>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">xharada</h1>
          <p className="text-gray-600">Sign in to access your goals</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>First time? Contact admin to create an account.</p>
        </div>
      </div>
    </div>
  );
}
