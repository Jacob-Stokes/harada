import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import FullGridView from '../components/FullGridView';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Guestbook from '../components/Guestbook';
import { useDisplaySettings } from '../context/DisplaySettingsContext';
import { getReadableTextColor, lightenColor } from '../utils/color';

interface ActivityLog {
  id: string;
  log_type: string;
  content: string;
  log_date: string;
  metric_value?: number;
  metric_unit?: string;
  mood?: string;
  created_at: string;
}

interface ActionItem {
  id: string;
  position: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  logs?: ActivityLog[];
  logCount?: number;
  lastLogDate?: string;
}

interface SubGoal {
  id: string;
  position: number;
  title: string;
  description?: string | null;
  actions: ActionItem[];
}

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  subGoals: SubGoal[];
}

export default function GoalGrid() {
  const { goalId } = useParams<{ goalId: string }>();
  const location = useLocation();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [actionLogs, setActionLogs] = useState<ActivityLog[]>([]);
  const { settings: displaySettings, computedColors } = useDisplaySettings();
  const [viewMode, setViewMode] = useState<'compact' | 'full'>(displaySettings.defaultView);
  const [gridAspect, setGridAspect] = useState<'square' | 'rectangle'>('square');
  const [selectedSubGoal, setSelectedSubGoal] = useState<SubGoal | null>(null);
  const [showSubGoalModal, setShowSubGoalModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [descriptionForm, setDescriptionForm] = useState('');
  const [draggingSubGoal, setDraggingSubGoal] = useState<SubGoal | null>(null);
  const [draggingAction, setDraggingAction] = useState<{ subGoalId: string; action: ActionItem } | null>(null);

  // Log form state
  const [logForm, setLogForm] = useState({
    log_type: 'note',
    content: '',
    log_date: new Date().toISOString().split('T')[0],
    metric_value: '',
    metric_unit: '',
    mood: ''
  });

  const buildSubGoalPayload = (
    subGoal: SubGoal,
    overrides?: Partial<{ title: string; description: string | null; position: number }>
  ) => ({
    title: overrides?.title ?? subGoal.title,
    description: overrides?.description ?? subGoal.description ?? null,
    position: overrides?.position ?? subGoal.position,
  });

  const buildActionPayload = (
    action: ActionItem,
    overrides?: Partial<{ title: string; description: string | null; position: number; due_date: string | null }>
  ) => ({
    title: overrides?.title ?? action.title,
    description: overrides?.description ?? action.description ?? null,
    position: overrides?.position ?? action.position,
    due_date: overrides?.due_date ?? action.due_date ?? null,
  });

  const findSubGoalById = (subGoalId: string) => {
    return goal?.subGoals.find((sg) => sg.id === subGoalId) || null;
  };

  const findActionById = (actionId: string) => {
    if (!goal) return null;
    for (const subGoal of goal.subGoals) {
      const action = subGoal.actions.find((a) => a.id === actionId);
      if (action) {
        return { subGoal, action };
      }
    }
    return null;
  };

  useEffect(() => {
    if (goalId) {
      loadGoal();
    }
  }, [goalId]);

  useEffect(() => {
    setViewMode(displaySettings.defaultView);
  }, [displaySettings.defaultView]);


  const loadGoal = async () => {
    try {
      setLoading(true);
      const data = await api.getGoal(goalId!);
      setGoal(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getSubGoalAtPosition = (position: number): SubGoal | undefined => {
    return goal?.subGoals.find(sg => sg.position === position);
  };

  const handleAddSubGoal = async (position: number) => {
    const title = prompt(`Enter sub-goal ${position} title:`);
    if (!title?.trim()) return;

    try {
      await api.createSubGoal(goalId!, { position, title: title.trim() });
      loadGoal();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddAction = async (subGoalId: string, position: number) => {
    const title = prompt(`Enter action ${position} title:`);
    if (!title?.trim()) return;

    try {
      await api.createAction(subGoalId, { position, title: title.trim() });
      loadGoal();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateSubGoal = async (id: string, title: string) => {
    const subGoal = findSubGoalById(id);
    if (!subGoal) return;

    try {
      await api.updateSubGoal(id, buildSubGoalPayload(subGoal, { title }));
      loadGoal();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateAction = async (id: string, title: string) => {
    const result = findActionById(id);
    if (!result) return;
    const { action } = result;

    try {
      await api.updateAction(id, buildActionPayload(action, { title }));
      loadGoal();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubGoalClick = (subGoal: SubGoal) => {
    setSelectedSubGoal(subGoal);
    setShowSubGoalModal(true);
  };

  const handleActionClick = async (action: ActionItem) => {
    setSelectedAction(action);
    setShowLogModal(true);

    try {
      const logs = await api.getActionLogs(action.id);
      setActionLogs(logs);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubGoalDragStart = (subGoal: SubGoal) => {
    setDraggingSubGoal(subGoal);
  };

  const handleSubGoalDragEnd = () => {
    setDraggingSubGoal(null);
  };

  const handleSubGoalDrop = async (targetPosition: number) => {
    if (!draggingSubGoal || draggingSubGoal.position === targetPosition) {
      setDraggingSubGoal(null);
      return;
    }

    try {
      await api.reorderSubGoal(draggingSubGoal.id, targetPosition);
      loadGoal();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleActionDragStart = (subGoalId: string, action: ActionItem) => {
    setDraggingAction({ subGoalId, action });
  };

  const handleActionDragEnd = () => {
    setDraggingAction(null);
  };

  const handleActionDrop = async (subGoalId: string, targetPosition: number) => {
    if (!draggingAction || draggingAction.subGoalId !== subGoalId) {
      setDraggingAction(null);
      return;
    }

    const currentAction = draggingAction.action;
    if (currentAction.position === targetPosition) {
      setDraggingAction(null);
      return;
    }

    try {
      await api.reorderAction(currentAction.id, targetPosition);
      loadGoal();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateGoalTitle = async (title: string) => {
    if (!title.trim() || !goal) return;

    try {
      await api.updateGoal(goal.id, { title: title.trim() });
      loadGoal();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleOpenDescriptionModal = () => {
    setDescriptionForm(goal?.description || '');
    setShowDescriptionModal(true);
  };

  const handlePrintGrid = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleSaveDescription = async () => {
    if (!goal) return;

    try {
      await api.updateGoal(goal.id, {
        title: goal.title,
        description: descriptionForm.trim() || null
      });
      setShowDescriptionModal(false);
      loadGoal();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction) return;

    try {
      const logData: any = {
        log_type: logForm.log_type,
        content: logForm.content,
        log_date: logForm.log_date,
      };

      if (logForm.metric_value) {
        logData.metric_value = parseFloat(logForm.metric_value);
        logData.metric_unit = logForm.metric_unit;
      }

      if (logForm.mood) {
        logData.mood = logForm.mood;
      }

      await api.createLog(selectedAction.id, logData);

      // Reload logs
      const logs = await api.getActionLogs(selectedAction.id);
      setActionLogs(logs);

      // Reset form
      setLogForm({
        log_type: 'note',
        content: '',
        log_date: new Date().toISOString().split('T')[0],
        metric_value: '',
        metric_unit: '',
        mood: ''
      });

      loadGoal(); // Refresh to update counts
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const renderSubGoalCard = (position: number) => {
    const subGoal = getSubGoalAtPosition(position);

    if (!subGoal) {
      return (
        <div
          onClick={() => handleAddSubGoal(position)}
          className="bg-yellow-50 border-2 border-dashed border-yellow-400 p-4 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors flex flex-col items-center justify-center h-full min-h-[120px]"
        >
          <div className="text-3xl text-yellow-600 mb-2">+</div>
          <div className="text-sm text-gray-600">Add Sub-Goal {position}</div>
        </div>
      );
    }

    const actionsWithActivity = subGoal.actions.length;
    const baseColor = computedColors[position] || '#22c55e';
    const cardBackground = lightenColor(baseColor, 70);
    const textColor = getReadableTextColor(cardBackground);

    return (
      <div
        className="p-4 rounded-lg transition-colors h-full min-h-[120px] flex flex-col"
        style={{
          backgroundColor: cardBackground,
          border: `2px solid ${baseColor}`,
          color: textColor,
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="font-semibold text-sm flex-1">{subGoal.title}</div>
          <div
            className="text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: lightenColor(baseColor, 30),
              color: getReadableTextColor(lightenColor(baseColor, 30)),
            }}
          >
            {position}
          </div>
        </div>
        <div className="mt-auto">
          <div className="text-xs opacity-80 mb-1">
            {actionsWithActivity}/8 actions defined
          </div>
          <div className="text-xs font-medium">
            Click actions to log activity →
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading goal...</p>
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Goal not found'}</p>
          <Link to="/" className="text-blue-600 hover:underline">Go back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Header - always constrained */}
      <div className="container mx-auto px-4 md:px-6 max-w-6xl mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 text-sm">
              <Link to="/" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                ← Back to Goals
              </Link>
              <span className="text-gray-400">•</span>
              <Link
                to="/settings"
                state={{ from: location.pathname }}
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                ⚙ Settings
              </Link>
            </div>
            <h1
              className="text-3xl font-bold text-gray-900 cursor-pointer hover:text-blue-600"
              onContextMenu={(e) => {
                e.preventDefault();
                const newTitle = prompt('Edit goal title:', goal.title);
                if (newTitle && newTitle.trim()) {
                  handleUpdateGoalTitle(newTitle.trim());
                }
              }}
              title="Right-click to rename"
            >
              {goal.title}
            </h1>
            {goal.description && <p className="text-gray-600 mt-1">{goal.description}</p>}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* View Mode Toggle */}
            <div className="flex flex-wrap gap-2 bg-white rounded-lg shadow p-1">
              <button
                onClick={() => setViewMode('compact')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded transition-colors text-sm ${
                  viewMode === 'compact'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Compact View
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded transition-colors text-sm ${
                  viewMode === 'full'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Full 9x9 Grid
              </button>
            </div>

            {/* Aspect Ratio Toggle (only show in full mode) */}
            {viewMode === 'full' && (
              <div className="flex flex-wrap gap-2 bg-white rounded-lg shadow p-1">
                <button
                  onClick={() => setGridAspect('square')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded transition-colors text-sm ${
                    gridAspect === 'square'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Square
                </button>
                <button
                  onClick={() => setGridAspect('rectangle')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded transition-colors text-sm ${
                    gridAspect === 'rectangle'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Rectangle
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePrintGrid}
              className="print-hidden px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors bg-white shadow"
            >
              Print Grid
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
            {error}
          </div>
        )}
      </div>

      {/* Content - responsive width based on view mode */}
      <div className={`container mx-auto px-4 md:px-6 ${viewMode === 'full' && gridAspect === 'rectangle' ? 'max-w-6xl lg:max-w-[85%]' : 'max-w-6xl'}`}>

        {viewMode === 'full' ? (
          <>
            <div className="printable-grid">
              <FullGridView
                goalTitle={goal.title}
                subGoals={goal.subGoals}
                onActionClick={handleActionClick}
                onSubGoalClick={handleSubGoalClick}
                onAddSubGoal={handleAddSubGoal}
                onAddAction={handleAddAction}
                onUpdateSubGoal={handleUpdateSubGoal}
                onUpdateAction={handleUpdateAction}
                gridAspect={gridAspect}
                onCenterClick={handleOpenDescriptionModal}
                subGoalColors={computedColors}
                actionColorSettings={{
                  inherit: displaySettings.inheritActionColors,
                  shadePercent: displaySettings.actionShadePercent,
                }}
                centerLayout={displaySettings.centerLayout}
                centerBackdrop={displaySettings.centerBackdrop}
                onSubGoalDragStart={handleSubGoalDragStart}
                onSubGoalDrop={handleSubGoalDrop}
                onSubGoalDragEnd={handleSubGoalDragEnd}
                onActionDragStart={handleActionDragStart}
                onActionDrop={handleActionDrop}
                onActionDragEnd={handleActionDragEnd}
              />
            </div>

            {/* Guestbook for this goal in full view */}
            <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
              <Guestbook targetType="goal" targetId={goal.id} />
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Top row - positions 1, 2, 3 */}
                {renderSubGoalCard(1)}
                {renderSubGoalCard(2)}
                {renderSubGoalCard(3)}

                {/* Middle row - position 8, center, position 4 */}
                {renderSubGoalCard(8)}
                <div
                  onClick={handleOpenDescriptionModal}
                  className="bg-blue-600 text-white p-6 rounded-lg flex items-center justify-center text-center font-bold text-xl min-h-[120px] cursor-pointer hover:bg-blue-700 transition-colors"
                  title="Click to edit description"
                >
                  {goal.title}
                </div>
                {renderSubGoalCard(4)}

                {/* Bottom row - positions 7, 6, 5 */}
                {renderSubGoalCard(7)}
                {renderSubGoalCard(6)}
                {renderSubGoalCard(5)}
              </div>

              <div className="mt-6 text-center text-sm text-gray-500">
                <p>Click on yellow cells to add sub-goals. Use "Full 9x9 Grid" view to see all actions nested in sub-goals.</p>
              </div>
            </div>

            {/* Action Items List for Compact View */}
            <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-lg font-semibold mb-4">All Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {goal.subGoals.flatMap(sg =>
                  sg.actions.length > 0 ? (
                    <div key={sg.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="text-xs font-semibold text-gray-600 mb-2">{sg.title}</div>
                      <div className="space-y-2">
                        {sg.actions.map(action => (
                          <div
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className="bg-white border border-gray-300 rounded p-2 cursor-pointer hover:shadow-md transition-shadow"
                          >
                            <div className="text-sm font-medium">{action.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Click to log activity
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : []
                )}
              </div>
            </div>

            {/* Hidden full grid just for printing when in compact mode */}
            <div className="printable-grid screen-hidden">
              <FullGridView
                goalTitle={goal.title}
                subGoals={goal.subGoals}
                onActionClick={handleActionClick}
                onSubGoalClick={handleSubGoalClick}
                onAddSubGoal={handleAddSubGoal}
                onAddAction={handleAddAction}
                onUpdateSubGoal={handleUpdateSubGoal}
                onUpdateAction={handleUpdateAction}
                gridAspect={gridAspect}
                onCenterClick={handleOpenDescriptionModal}
                subGoalColors={computedColors}
                actionColorSettings={{
                  inherit: displaySettings.inheritActionColors,
                  shadePercent: displaySettings.actionShadePercent,
                }}
                centerLayout={displaySettings.centerLayout}
                centerBackdrop={displaySettings.centerBackdrop}
              />
            </div>

            {/* Guestbook for this goal */}
            <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
              <Guestbook targetType="goal" targetId={goal.id} />
            </div>
          </>
        )}
      </div>

      {/* Activity Log Modal */}
      {showLogModal && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedAction.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">Activity Log</p>
                </div>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Add Log Form */}
            <div className="p-6 border-b bg-gray-50">
              <h3 className="font-semibold mb-3">Log New Activity</h3>
              <form onSubmit={handleAddLog} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={logForm.log_type}
                      onChange={(e) => setLogForm({...logForm, log_type: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="note">Note</option>
                      <option value="progress">Progress</option>
                      <option value="completion">Completion</option>
                      <option value="link">Link</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input
                      type="date"
                      value={logForm.log_date}
                      onChange={(e) => setLogForm({...logForm, log_date: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Note</label>
                  <textarea
                    value={logForm.content}
                    onChange={(e) => setLogForm({...logForm, content: e.target.value})}
                    placeholder="What did you do?"
                    className="w-full px-3 py-2 border rounded"
                    rows={2}
                    required
                  />
                </div>

                {logForm.log_type === 'progress' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Metric Value</label>
                      <input
                        type="number"
                        step="0.1"
                        value={logForm.metric_value}
                        onChange={(e) => setLogForm({...logForm, metric_value: e.target.value})}
                        placeholder="5.0"
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Unit</label>
                      <input
                        type="text"
                        value={logForm.metric_unit}
                        onChange={(e) => setLogForm({...logForm, metric_unit: e.target.value})}
                        placeholder="km, lbs, hours..."
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">How did it feel?</label>
                  <select
                    value={logForm.mood}
                    onChange={(e) => setLogForm({...logForm, mood: e.target.value})}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="">Select mood (optional)</option>
                    <option value="motivated">Motivated</option>
                    <option value="accomplished">Accomplished</option>
                    <option value="challenged">Challenged</option>
                    <option value="frustrated">Frustrated</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Log Entry
                </button>
              </form>
            </div>

            {/* Activity Log List */}
            <div className="p-6">
              <h3 className="font-semibold mb-4">Activity History ({actionLogs.length})</h3>
              {actionLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No activity logged yet. Add your first entry above!</p>
              ) : (
                <div className="space-y-3">
                  {actionLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {log.log_type}
                          </span>
                          {log.mood && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              {log.mood}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{log.log_date}</span>
                      </div>
                      <p className="text-sm text-gray-900 mb-1">{log.content}</p>
                      {log.metric_value && (
                        <div className="text-sm font-medium text-green-700">
                          {log.metric_value} {log.metric_unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Guestbook for this action */}
            <div className="p-6 border-t">
              <Guestbook targetType="action" targetId={selectedAction.id} />
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowLogModal(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description Editor Modal */}
      {showDescriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Edit Goal Description</h2>
                  <p className="text-sm text-gray-600 mt-1">Use markdown for formatting</p>
                </div>
                <button
                  onClick={() => setShowDescriptionModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Editor */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Markdown Editor</label>
                  <textarea
                    value={descriptionForm}
                    onChange={(e) => setDescriptionForm(e.target.value)}
                    placeholder="Enter your goal description in markdown...

**Example:**
- Use **bold** and *italic*
- Create lists
- Add [links](https://example.com)
- And more!"
                    className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Preview</label>
                  <div className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg overflow-y-auto bg-gray-50">
                    {descriptionForm.trim() ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {descriptionForm}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">Preview will appear here...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowDescriptionModal(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDescription}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Description
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Goal Detail Modal */}
      {showSubGoalModal && selectedSubGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedSubGoal.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">Manage Actions</p>
                </div>
                <button
                  onClick={() => setShowSubGoalModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Actions List */}
            <div className="p-6">
              <h3 className="font-semibold mb-4">Actions ({selectedSubGoal.actions.length}/8)</h3>
              <div className="space-y-2">
                {Array.from({ length: 8 }, (_, i) => i + 1).map((position) => {
                  const action = selectedSubGoal.actions.find(a => a.position === position);

                  if (action) {
                    return (
                      <div
                        key={position}
                        className="border border-gray-300 rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-sm font-semibold text-gray-500 w-6">#{position}</span>
                            <div
                              className="flex-1 cursor-pointer hover:text-blue-600"
                              onClick={() => handleActionClick(action)}
                            >
                              {action.title}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const newTitle = prompt('Rename action:', action.title);
                                if (newTitle && newTitle.trim()) {
                                  handleUpdateAction(action.id, newTitle.trim());
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1"
                            >
                              Rename
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Delete action "${action.title}"?`)) {
                                  try {
                                    await api.deleteAction(action.id);
                                    loadGoal();
                                    // Update selected sub-goal
                                    const updated = goal?.subGoals.find(sg => sg.id === selectedSubGoal.id);
                                    if (updated) setSelectedSubGoal(updated);
                                  } catch (err) {
                                    setError((err as Error).message);
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={position}
                      onClick={() => handleAddAction(selectedSubGoal.id, position)}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-400 w-6">#{position}</span>
                        <span className="text-gray-500 text-sm">+ Add action</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Guestbook for this sub-goal */}
            <div className="p-6 border-t">
              <Guestbook targetType="subgoal" targetId={selectedSubGoal.id} />
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowSubGoalModal(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
