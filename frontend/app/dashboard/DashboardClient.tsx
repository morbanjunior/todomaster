'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type User = { id: number; name: string; email: string };
type Task = { id: string; title: string; description?: string; user_id: number };
type SvcStatus = 'ok' | 'down' | 'checking';
type Alert = { text: string; type: 'success' | 'error' | 'warning' };

export default function DashboardClient({ userId }: { userId: number }) {
    const router = useRouter();

    // ─── PER-SERVICE STATE ─────────────────────────────────────────────────────
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [tasksError, setTasksError] = useState<string | null>(null);

    // ─── UI STATE ──────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'users' | 'tasks'>('users');
    const [alertMsg, setAlertMsg] = useState<Alert | null>(null);
    const [svcStatus, setSvcStatus] = useState<Record<string, SvcStatus>>({
        auth: 'checking', users: 'checking', tasks: 'checking',
    });

    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDesc, setTaskDesc] = useState('');

    // ─── HELPERS ───────────────────────────────────────────────────────────────

    const showAlert = (text: string, type: Alert['type'] = 'error') => {
        setAlertMsg({ text, type });
        setTimeout(() => setAlertMsg(null), 7000);
    };

    const logout = useCallback(async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    }, [router]);

    // ─── INDEPENDENT SERVICE LOADERS ───────────────────────────────────────────
    // Each service loads, fails, and retries completely independently.
    // A failure in one never affects the state of the other.

    const loadUsers = useCallback(async () => {
        setUsersLoading(true);
        setUsersError(null);
        try {
            const res = await fetch('/api/users');
            if (res.status === 401) { logout(); return; }
            if (res.ok) {
                setUsers(await res.json());
            } else {
                const d = await res.json();
                setUsersError(d.detail ?? 'Error al cargar el perfil.');
            }
        } catch {
            setUsersError('No se pudo conectar al servicio de usuarios.');
        } finally {
            setUsersLoading(false);
        }
    }, [logout]);

    const loadTasks = useCallback(async () => {
        setTasksLoading(true);
        setTasksError(null);
        try {
            const res = await fetch('/api/tasks');
            if (res.status === 401) { logout(); return; }
            if (res.ok) {
                setTasks(await res.json());
            } else {
                const d = await res.json();
                setTasksError(d.detail ?? 'Error al cargar las tareas.');
            }
        } catch {
            setTasksError('No se pudo conectar al servicio de tareas.');
        } finally {
            setTasksLoading(false);
        }
    }, [logout]);

    // Services load in parallel but fail independently
    useEffect(() => { loadUsers(); }, [loadUsers]);
    useEffect(() => { loadTasks(); }, [loadTasks]);

    // ─── HEALTH CHECKS ─────────────────────────────────────────────────────────

    const checkServicesHealth = useCallback(async () => {
        setSvcStatus({ auth: 'checking', users: 'checking', tasks: 'checking' });

        const check = async (service: string): Promise<{ service: string; status: SvcStatus }> => {
            try {
                const res = await fetch(`/api/health/${service}`);
                return { service, status: res.ok ? 'ok' : 'down' };
            } catch {
                return { service, status: 'down' };
            }
        };

        // Health checks also run in parallel and fail independently
        const results = await Promise.allSettled([
            check('auth'),
            check('users'),
            check('tasks'),
        ]);

        const next: Record<string, SvcStatus> = {};
        results.forEach(r => {
            if (r.status === 'fulfilled') next[r.value.service] = r.value.status;
        });
        setSvcStatus(next);
    }, []);

    useEffect(() => { checkServicesHealth(); }, [checkServicesHealth]);

    // ─── USER CRUD ─────────────────────────────────────────────────────────────

    const openUserModal = (user?: User) => {
        if (user) { setEditingUserId(user.id); setUserName(user.name); setUserEmail(user.email); }
        else      { setEditingUserId(null);    setUserName('');        setUserEmail(''); }
        setIsUserModalOpen(true);
    };

    const handleUserSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/users/${editingUserId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: userName, email: userEmail }),
            });
            if (res.status === 401) { logout(); return; }
            if (res.status === 403) { showAlert('No tienes permiso para modificar este perfil.', 'error'); return; }
            if (res.ok) {
                showAlert('Perfil actualizado con éxito.', 'success');
                setIsUserModalOpen(false);
                loadUsers(); // only reloads the users service
            } else {
                const d = await res.json();
                showAlert(d.detail ?? 'Error al actualizar perfil.', 'error');
            }
        } catch { showAlert('No se pudo conectar al servicio de usuarios.', 'warning'); }
    };

    const deleteUser = async (id: number) => {
        if (!confirm('¿Eliminar tu cuenta? Tus tareas también se borrarán. Esta acción no se puede deshacer.')) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (res.status === 401) { logout(); return; }
            if (res.status === 403) { showAlert('No tienes permiso para eliminar esta cuenta.', 'error'); return; }
            if (res.ok) {
                showAlert('Cuenta eliminada.', 'success');
                logout();
            } else {
                const d = await res.json();
                showAlert(d.detail ?? 'Error al eliminar cuenta.', 'error');
            }
        } catch { showAlert('No se pudo conectar al servicio de usuarios.', 'warning'); }
    };

    // ─── TASK CRUD ─────────────────────────────────────────────────────────────

    const openTaskModal = (task?: Task) => {
        if (task) { setEditingTaskId(task.id); setTaskTitle(task.title); setTaskDesc(task.description ?? ''); }
        else      { setEditingTaskId(null);    setTaskTitle('');          setTaskDesc(''); }
        setIsTaskModalOpen(true);
    };

    const handleTaskSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        const url    = editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks';
        const method = editingTaskId ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: taskTitle, description: taskDesc }),
            });
            if (res.status === 401) { logout(); return; }
            if (res.status === 403) { showAlert('No tienes permiso sobre esta tarea.', 'error'); return; }
            if (res.ok) {
                showAlert(`Tarea ${editingTaskId ? 'actualizada' : 'creada'} con éxito.`, 'success');
                setIsTaskModalOpen(false);
                loadTasks(); // only reloads the tasks service
            } else {
                const d = await res.json();
                showAlert(d.detail ?? 'Error al guardar la tarea.', 'error');
            }
        } catch { showAlert('No se pudo conectar al servicio de tareas.', 'warning'); }
    };

    const deleteTask = async (id: string) => {
        if (!confirm('¿Eliminar esta tarea?')) return;
        try {
            const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            if (res.status === 401) { logout(); return; }
            if (res.status === 403) { showAlert('No puedes eliminar una tarea que no es tuya.', 'error'); return; }
            if (res.ok) {
                showAlert('Tarea eliminada.', 'success');
                loadTasks(); // only reloads the tasks service
            } else {
                const d = await res.json();
                showAlert(d.detail ?? 'Error al eliminar tarea.', 'error');
            }
        } catch { showAlert('No se pudo conectar al servicio de tareas.', 'warning'); }
    };

    // ─── UI HELPERS ────────────────────────────────────────────────────────────

    const statusDot = (key: string) => {
        const s = svcStatus[key] ?? 'checking';
        const cls =
            s === 'ok'    ? 'bg-emerald-400' :
            s === 'down'  ? 'bg-red-500' :
                            'bg-yellow-400 animate-pulse';
        return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
    };

    const ServiceError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
        <div className="p-6 rounded-lg bg-red-900/20 border border-red-700 text-red-300 text-sm flex items-center justify-between">
            <span>⚠ {message}</span>
            <button onClick={onRetry}
                className="ml-4 text-xs border border-red-700 hover:border-red-500 px-3 py-1 rounded transition-colors">
                Reintentar
            </button>
        </div>
    );

    // ─── RENDER ────────────────────────────────────────────────────────────────

    return (
        <main className="min-h-screen bg-linear-to-br from-gray-900 via-slate-900 to-black text-white font-sans p-6 md:p-12">
            <div className="max-w-5xl mx-auto">

                <header className="mb-4 flex justify-between items-center">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400">
                        Command Center
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-sm">
                            ID: <span className="text-emerald-400 font-mono">{userId}</span>
                        </span>
                        <button onClick={logout}
                            className="text-sm text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors">
                            Cerrar sesión
                        </button>
                    </div>
                </header>

                {/* Service status bar */}
                <div className="flex flex-wrap gap-4 mb-6 px-1 text-xs text-slate-400 items-center">
                    {(['auth', 'users', 'tasks'] as const).map(key => (
                        <span key={key} className="flex items-center gap-1.5">
                            {statusDot(key)}
                            <span className={svcStatus[key] === 'down' ? 'text-red-400 font-semibold capitalize' : 'capitalize'}>{key}</span>
                            {svcStatus[key] === 'down' && <span className="text-red-500">✕ caído</span>}
                        </span>
                    ))}
                    <button onClick={checkServicesHealth}
                        className="ml-auto text-slate-600 hover:text-slate-300 transition-colors text-xs border border-slate-700 hover:border-slate-500 px-2 py-1 rounded">
                        ↺ verificar
                    </button>
                </div>

                {alertMsg && (
                    <div className={`mb-6 p-4 rounded-lg border font-medium ${
                        alertMsg.type === 'success' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-300' :
                        alertMsg.type === 'warning' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-300' :
                                                      'bg-red-900/30 border-red-500 text-red-300'
                    }`}>
                        {alertMsg.text}
                    </div>
                )}

                <div className="flex border-b border-slate-700 mb-8">
                    <button
                        className={`flex-1 py-4 text-lg font-semibold transition-colors border-b-2 ${activeTab === 'users' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        onClick={() => setActiveTab('users')}>
                        Mi Perfil
                    </button>
                    <button
                        className={`flex-1 py-4 text-lg font-semibold transition-colors border-b-2 ${activeTab === 'tasks' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        onClick={() => setActiveTab('tasks')}>
                        Mis Tareas
                    </button>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700 shadow-xl min-h-125">

                    {activeTab === 'users' && (
                        <div>
                            <h2 className="text-2xl font-bold text-emerald-300 mb-6">Mi Perfil</h2>
                            {usersLoading && <p className="text-slate-500 text-center py-8">Cargando perfil...</p>}
                            {!usersLoading && usersError && <ServiceError message={usersError} onRetry={loadUsers} />}
                            {!usersLoading && !usersError && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-700 text-slate-400">
                                                <th className="p-3">ID</th><th className="p-3">Nombre</th>
                                                <th className="p-3">Email</th><th className="p-3 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.length === 0 && (
                                                <tr><td colSpan={4} className="p-6 text-center text-slate-500">Sin datos.</td></tr>
                                            )}
                                            {users.map(user => (
                                                <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                                                    <td className="p-3 text-emerald-400 font-mono">{user.id}</td>
                                                    <td className="p-3 font-medium">{user.name}</td>
                                                    <td className="p-3 text-slate-300">{user.email}</td>
                                                    <td className="p-3 text-right space-x-3">
                                                        <button onClick={() => openUserModal(user)}
                                                            className="text-blue-400 hover:text-blue-300 text-sm font-medium">Editar</button>
                                                        <button onClick={() => deleteUser(user.id)}
                                                            className="text-red-400 hover:text-red-300 text-sm font-medium">Eliminar cuenta</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-purple-300">Mis Tareas</h2>
                                <button onClick={() => openTaskModal()} disabled={!!tasksError}
                                    title={tasksError ?? ''}
                                    className="bg-purple-500 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-lg shadow-purple-500/20">
                                    + Nueva Tarea
                                </button>
                            </div>
                            {tasksLoading && <p className="text-slate-500 text-center py-8">Cargando tareas...</p>}
                            {!tasksLoading && tasksError && <ServiceError message={tasksError} onRetry={loadTasks} />}
                            {!tasksLoading && !tasksError && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-700 text-slate-400">
                                                <th className="p-3">ID</th><th className="p-3">Título</th>
                                                <th className="p-3 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tasks.length === 0 && (
                                                <tr><td colSpan={3} className="p-6 text-center text-slate-500">No tienes tareas aún.</td></tr>
                                            )}
                                            {tasks.map(task => (
                                                <tr key={task.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                                                    <td className="p-3 text-purple-400 font-mono text-xs max-w-25 truncate">{task.id}</td>
                                                    <td className="p-3 font-medium">
                                                        {task.title}
                                                        <span className="block text-xs text-slate-400">{task.description}</span>
                                                    </td>
                                                    <td className="p-3 text-right space-x-3">
                                                        <button onClick={() => openTaskModal(task)}
                                                            className="text-blue-400 hover:text-blue-300 text-sm font-medium">Editar</button>
                                                        <button onClick={() => deleteTask(task.id)}
                                                            className="text-red-400 hover:text-red-300 text-sm font-medium">Eliminar</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isUserModalOpen && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                        <div className="bg-slate-800 border border-emerald-500/30 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                            <h3 className="text-2xl font-bold text-emerald-400 mb-6">Editar Perfil</h3>
                            <form onSubmit={handleUserSubmit} className="space-y-4">
                                <input type="text" placeholder="Nombre completo" required value={userName}
                                    onChange={e => setUserName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 focus:border-emerald-500 text-white rounded-lg p-3 outline-none" />
                                <input type="email" placeholder="Correo electrónico" required value={userEmail}
                                    onChange={e => setUserEmail(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 focus:border-emerald-500 text-white rounded-lg p-3 outline-none" />
                                <div className="flex gap-4 mt-6">
                                    <button type="button" onClick={() => setIsUserModalOpen(false)}
                                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors">Cancelar</button>
                                    <button type="submit"
                                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-colors">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isTaskModalOpen && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                        <div className="bg-slate-800 border border-purple-500/30 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                            <h3 className="text-2xl font-bold text-purple-400 mb-6">{editingTaskId ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
                            <form onSubmit={handleTaskSubmit} className="space-y-4">
                                <input type="text" placeholder="Título" required value={taskTitle}
                                    onChange={e => setTaskTitle(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 focus:border-purple-500 text-white rounded-lg p-3 outline-none" />
                                <textarea placeholder="Descripción (opcional)" value={taskDesc}
                                    onChange={e => setTaskDesc(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 focus:border-purple-500 text-white rounded-lg p-3 outline-none min-h-25" />
                                <div className="flex gap-4 mt-6">
                                    <button type="button" onClick={() => setIsTaskModalOpen(false)}
                                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors">Cancelar</button>
                                    <button type="submit"
                                        className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold transition-colors">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}
