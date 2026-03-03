import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import FullGridView from '../components/FullGridView';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Guestbook from '../components/Guestbook';
import ShareGoalModal from '../components/ShareGoalModal';
import ConfirmModal from '../components/ConfirmModal';
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

type TextModalState =
  | { mode: 'add-subgoal'; position: number }
  | { mode: 'add-action'; subGoalId: string; position: number }
  | { mode: 'rename-subgoal'; subGoal: SubGoal }
  | { mode: 'rename-action'; action: ActionItem }
  | { mode: 'rename-goal'; goalId: string };

export default function GoalGrid() {
  const { t } = useTranslation();
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
  const [textModal, setTextModal] = useState<TextModalState | null>(null);
  const [textModalValue, setTextModalValue] = useState('');
  const [textModalError, setTextModalError] = useState<string | null>(null);
  const [textModalSubmitting, setTextModalSubmitting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [confirmDeleteAction, setConfirmDeleteAction] = useState<ActionItem | null>(null);
  const subGoalCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const actionSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const openTextModal = (modalState: TextModalState, initialValue = '') => {
    setTextModal(modalState);
    setTextModalValue(initialValue);
    setTextModalError(null);
  };

  const scrollToActionSection = (subGoal: SubGoal) => {
    const el = actionSectionRefs.current[subGoal.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring', 'ring-blue-300');
      setTimeout(() => el.classList.remove('ring', 'ring-blue-300'), 1200);
    }
  };

  const scrollToSubGoalCard = (position: number) => {
    const el = subGoalCardRefs.current[position];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring', 'ring-blue-300');
      setTimeout(() => el.classList.remove('ring', 'ring-blue-300'), 1200);
    }
  };

  const handleAddSubGoal = (position: number) => {
    openTextModal({ mode: 'add-subgoal', position }, '');
  };

  const handleAddAction = (subGoalId: string, position: number) => {
    openTextModal({ mode: 'add-action', subGoalId, position }, '');
  };

  const handleUpdateSubGoal = (subGoal: SubGoal) => {
    openTextModal({ mode: 'rename-subgoal', subGoal }, subGoal.title);
  };

  const handleUpdateAction = (action: ActionItem) => {
    openTextModal({ mode: 'rename-action', action }, action.title);
  };

  const handleSubGoalClick = (subGoal: SubGoal) => {
    setSelectedSubGoal(subGoal);
    setShowSubGoalModal(true);
  };

  const startRenameGoal = () => {
    if (!goal) return;
    openTextModal({ mode: 'rename-goal', goalId: goal.id }, goal.title);
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

  const getTextModalHeading = () => {
    if (!textModal) return '';
    switch (textModal.mode) {
      case 'add-subgoal':
        return t('goalGrid.addSubGoal', { position: textModal.position });
      case 'add-action':
        return t('goalGrid.addAction', { position: textModal.position });
      case 'rename-subgoal':
        return t('goalGrid.renameSubGoal');
      case 'rename-action':
        return t('goalGrid.renameAction');
      case 'rename-goal':
        return t('goalGrid.renameGoal');
      default:
        return '';
    }
  };

  const handleTextModalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textModal) return;
    const value = textModalValue.trim();
    if (!value) {
      setTextModalError(t('goalGrid.pleaseEnterName'));
      return;
    }
    try {
      setTextModalSubmitting(true);
      switch (textModal.mode) {
        case 'add-subgoal': {
          if (!goalId) throw new Error('Goal not found.');
          await api.createSubGoal(goalId, { position: textModal.position, title: value });
          await loadGoal();
          break;
        }
        case 'add-action': {
          await api.createAction(textModal.subGoalId, { position: textModal.position, title: value });
          await loadGoal();
          break;
        }
        case 'rename-subgoal': {
          await api.updateSubGoal(
            textModal.subGoal.id,
            buildSubGoalPayload(textModal.subGoal, { title: value })
          );
          await loadGoal();
          break;
        }
        case 'rename-action': {
          await api.updateAction(
            textModal.action.id,
            buildActionPayload(textModal.action, { title: value })
          );
          await loadGoal();
          break;
        }
        case 'rename-goal': {
          await handleUpdateGoalTitle(value);
          break;
        }
        default:
          break;
      }
      setTextModal(null);
      setTextModalValue('');
      setTextModalError(null);
    } catch (err) {
      setTextModalError((err as Error).message);
    } finally {
      setTextModalSubmitting(false);
    }
  };

  const renderSubGoalCard = (position: number) => {
    const subGoal = getSubGoalAtPosition(position);

    const setCardRef = (el: HTMLDivElement | null) => {
      subGoalCardRefs.current[position] = el;
    };

    if (!subGoal) {
      return (
        <div
          ref={setCardRef}
          onClick={() => handleAddSubGoal(position)}
          className="bg-yellow-50 border-2 border-dashed border-yellow-400 p-4 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors flex flex-col items-center justify-center h-full min-h-[120px]"
        >
          <div className="text-3xl text-yellow-600 mb-2">+</div>
          <div className="text-sm text-gray-600">{t('goalGrid.addSubGoalGrid', { position })}</div>
        </div>
      );
    }

    const actionsWithActivity = subGoal.actions.length;
    const baseColor = computedColors[position] || '#22c55e';
    const cardBackground = lightenColor(baseColor, 70);
    const textColor = getReadableTextColor(cardBackground);

      return (
        <div
          ref={setCardRef}
          className="p-4 rounded-lg transition-colors h-full min-h-[120px] flex flex-col"
          onClick={() => scrollToActionSection(subGoal)}
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
            {actionsWithActivity}{t('goalGrid.actionsCount')}
          </div>
          <div className="text-xs font-medium">
            {t('goalGrid.clickActionsHint')}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">{t('goalGrid.loadingGoal')}</p>
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || t('goalGrid.goalNotFound')}</p>
          <Link to="/" className="text-blue-600 hover:underline">{t('goalGrid.goBackHome')}</Link>
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
                {t('goalGrid.backToGoals')}
              </Link>
              <span className="text-gray-400">•</span>
              <Link
                to="/settings"
                state={{ from: location.pathname }}
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                {t('goalGrid.settingsIcon')}
              </Link>
            </div>
            <h1
              className="text-3xl font-bold text-gray-900 cursor-pointer hover:text-blue-600"
              onContextMenu={(e) => {
                e.preventDefault();
                startRenameGoal();
              }}
              title={t('goalGrid.rightClickToRename')}
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
                {t('goalGrid.compactView')}
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded transition-colors text-sm ${
                  viewMode === 'full'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t('goalGrid.fullGrid')}
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
                  {t('goalGrid.square')}
                </button>
                <button
                  onClick={() => setGridAspect('rectangle')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded transition-colors text-sm ${
                    gridAspect === 'rectangle'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t('goalGrid.rectangle')}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="print-hidden px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors bg-white shadow"
            >
              {t('goalGrid.shareGoal')}
            </button>
            <button
              type="button"
              onClick={handlePrintGrid}
              className="print-hidden px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors bg-white shadow"
            >
              {t('goalGrid.printGrid')}
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
                  title={t('goalGrid.editGoalDescription')}
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
                <p>{t('goalGrid.clickYellowCells')}</p>
              </div>
            </div>

            {/* Action Items List for Compact View */}
            <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-lg font-semibold mb-4">{t('goalGrid.allActions')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {goal.subGoals.map((sg) => (
                  <div
                    key={sg.id}
                    ref={(el) => {
                      actionSectionRefs.current[sg.id] = el;
                    }}
                    className="border rounded-lg p-3 bg-gray-50 scroll-mt-24"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-gray-600 mb-2">
                      <span>{sg.title}</span>
                      <button
                        type="button"
                        onClick={() => scrollToSubGoalCard(sg.position)}
                        className="text-blue-600 hover:text-blue-800 text-[11px]"
                      >
                        {t('goalGrid.backToGrid')}
                      </button>
                    </div>
                    {sg.actions.length === 0 ? (
                      <div className="text-xs text-gray-500 bg-white border border-dashed border-gray-300 rounded p-3">
                        {t('goalGrid.noActions')}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sg.actions.map((action) => (
                          <div
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className="bg-white border border-gray-300 rounded p-2 cursor-pointer hover:shadow-md transition-shadow"
                          >
                            <div className="text-sm font-medium">{action.title}</div>
                            <div className="text-xs text-gray-500 mt-1">{t('goalGrid.clickToLogActivity')}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
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

      {/* Text Input Modal */}
      {textModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleTextModalSubmit}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{getTextModalHeading()}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {textModal.mode === 'add-subgoal' &&
                  t('goalGrid.addSubGoalPrompt')}
                {textModal.mode === 'add-action' &&
                  t('goalGrid.addActionPrompt')}
                {textModal.mode === 'rename-subgoal' && t('goalGrid.renameSubGoalPrompt')}
                {textModal.mode === 'rename-action' && t('goalGrid.renameActionPrompt')}
                {textModal.mode === 'rename-goal' && t('goalGrid.renameGoalPrompt')}
              </p>
            </div>
            <input
              type="text"
              value={textModalValue}
              onChange={(e) => setTextModalValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {textModalError && (
              <div className="text-sm text-red-600">{textModalError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTextModal(null);
                  setTextModalError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={textModalSubmitting}
                className={`px-4 py-2 rounded text-sm text-white ${
                  textModalSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {textModalSubmitting ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activity Log Modal */}
      {showLogModal && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedAction.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">{t('goalGrid.activityLog')}</p>
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
              <h3 className="font-semibold mb-3">{t('goalGrid.logNewActivity')}</h3>
              <form onSubmit={handleAddLog} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('goalGrid.logType')}</label>
                    <select
                      value={logForm.log_type}
                      onChange={(e) => setLogForm({...logForm, log_type: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="note">{t('goalGrid.logTypeNote')}</option>
                      <option value="progress">{t('goalGrid.logTypeProgress')}</option>
                      <option value="completion">{t('goalGrid.logTypeCompletion')}</option>
                      <option value="link">{t('goalGrid.logTypeLink')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('goalGrid.logDate')}</label>
                    <input
                      type="date"
                      value={logForm.log_date}
                      onChange={(e) => setLogForm({...logForm, log_date: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">{t('goalGrid.logNote')}</label>
                  <textarea
                    value={logForm.content}
                    onChange={(e) => setLogForm({...logForm, content: e.target.value})}
                    placeholder={t('goalGrid.logNotePlaceholder')}
                    className="w-full px-3 py-2 border rounded"
                    rows={2}
                    required
                  />
                </div>

                {logForm.log_type === 'progress' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">{t('goalGrid.metricValue')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={logForm.metric_value}
                        onChange={(e) => setLogForm({...logForm, metric_value: e.target.value})}
                        placeholder={t('goalGrid.metricValuePlaceholder')}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{t('goalGrid.metricUnit')}</label>
                      <input
                        type="text"
                        value={logForm.metric_unit}
                        onChange={(e) => setLogForm({...logForm, metric_unit: e.target.value})}
                        placeholder={t('goalGrid.metricUnitPlaceholder')}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">{t('goalGrid.mood')}</label>
                  <select
                    value={logForm.mood}
                    onChange={(e) => setLogForm({...logForm, mood: e.target.value})}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="">{t('goalGrid.moodSelect')}</option>
                    <option value="motivated">{t('goalGrid.moodMotivated')}</option>
                    <option value="accomplished">{t('goalGrid.moodAccomplished')}</option>
                    <option value="challenged">{t('goalGrid.moodChallenged')}</option>
                    <option value="frustrated">{t('goalGrid.moodFrustrated')}</option>
                    <option value="neutral">{t('goalGrid.moodNeutral')}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('goalGrid.addLogEntry')}
                </button>
              </form>
            </div>

            {/* Activity Log List */}
            <div className="p-6">
              <h3 className="font-semibold mb-4">{t('goalGrid.activityHistory', { count: actionLogs.length })}</h3>
              {actionLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('goalGrid.noActivityLogged')}</p>
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
                {t('common.close')}
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
                  <h2 className="text-2xl font-bold text-gray-900">{t('goalGrid.editGoalDescription')}</h2>
                  <p className="text-sm text-gray-600 mt-1">{t('goalGrid.useMarkdownFormatting')}</p>
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
                  <label className="block text-sm font-semibold mb-2">{t('goalGrid.markdownEditor')}</label>
                  <textarea
                    value={descriptionForm}
                    onChange={(e) => setDescriptionForm(e.target.value)}
                    placeholder={t('goalGrid.markdownPlaceholder')}
                    className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-semibold mb-2">{t('common.preview')}</label>
                  <div className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg overflow-y-auto bg-gray-50">
                    {descriptionForm.trim() ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {descriptionForm}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">{t('goalGrid.previewWillAppear')}</p>
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
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveDescription}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t('goalGrid.saveDescription')}
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
                  <h2
                    className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => handleUpdateSubGoal(selectedSubGoal)}
                    title={t('goalGrid.clickToRename')}
                  >
                    {selectedSubGoal.title}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">{t('goalGrid.manageActions')}<span className="text-blue-500 cursor-pointer hover:underline" onClick={() => handleUpdateSubGoal(selectedSubGoal)}>{t('common.rename')}</span></p>
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
              <h3 className="font-semibold mb-4">{t('goalGrid.actionsOf8', { count: selectedSubGoal.actions.length })}</h3>
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
                              onClick={() => handleUpdateAction(action)}
                              className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1"
                            >
                              {t('common.rename')}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteAction(action)}
                              className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                            >
                              {t('common.delete')}
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
                        <span className="text-gray-500 text-sm">{t('goalGrid.addActionButton')}</span>
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
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Action Modal */}
      {confirmDeleteAction && selectedSubGoal && (
        <ConfirmModal
          title={t('goalGrid.deleteActionTitle')}
          message={t('goalGrid.deleteActionMessage', { title: confirmDeleteAction.title })}
          confirmLabel={t('common.delete')}
          onConfirm={async () => {
            try {
              await api.deleteAction(confirmDeleteAction.id);
              setConfirmDeleteAction(null);
              await loadGoal();
              const updated = goal?.subGoals.find(sg => sg.id === selectedSubGoal.id);
              if (updated) setSelectedSubGoal(updated);
            } catch (err) {
              setError((err as Error).message);
              setConfirmDeleteAction(null);
            }
          }}
          onCancel={() => setConfirmDeleteAction(null)}
        />
      )}

      {/* Share Goal Modal */}
      {showShareModal && goal && (
        <ShareGoalModal
          goalId={goal.id}
          goalTitle={goal.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
